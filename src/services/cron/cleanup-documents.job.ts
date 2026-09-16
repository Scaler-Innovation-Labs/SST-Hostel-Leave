import { type ActingRef, systemActor } from "@/constants/audit/actor";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import {
  DOCUMENT_RETENTION_BATCH_SIZE,
  DOCUMENT_RETENTION_YEARS,
} from "@/constants/leave/document-retention";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import { transaction } from "@/lib/db/transaction";
import { logger } from "@/lib/logger";
import {
  deleteByKey,
  extractKeyFromUrl,
  getS3KeyFromMetadata,
} from "@/lib/s3";
import { auditService } from "@/services/audit/audit.service";

const JOB = "document-retention";

export type DocumentRetentionJobResult = {
  job: string;
  deleted: number;
  failed: number;
  cutoff: string;
  errors: string[];
};

/**
 * Document retention job: deletes S3 objects whose owning leave
 * reached a terminal state more than DOCUMENT_RETENTION_YEARS ago and
 * soft-deletes the DB row so the audit trail survives.
 *
 * Storage math (per audit §35): ~40 GB/year at full scale if documents
 * live forever — this job caps that growth.
 *
 * The soft-delete and its audit record commit together: a document must
 * never be marked DELETED without the trail that explains why.
 */
export async function runDocumentRetentionJob(
  actor: ActingRef = systemActor(JOB)
): Promise<DocumentRetentionJobResult> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - DOCUMENT_RETENTION_YEARS);

  const errors: string[] = [];
  // A document that failed above stays ACTIVE and would be returned by the
  // next query. Remember what this run already tried so a persistent failure
  // cannot spin the batch loop forever.
  const attempted = new Set<string>();
  let deletedCount = 0;
  let failedCount = 0;

  // Bounded batches: a large first-run backlog must not starve the worker
  // or hammer S3 rate limits.
  while (true) {
    const batch = await leaveDocumentRepository.findExpiredForRetention(
      cutoff,
      DOCUMENT_RETENTION_BATCH_SIZE
    );

    const expired = batch.filter((document) => !attempted.has(document.id));

    if (expired.length === 0) break;

    for (const document of expired) {
      attempted.add(document.id);

      // Per-item isolation: one S3/DB failure must not abort the
      // rest of the batch. A `false` delete result keeps the row ACTIVE
      // for a later run instead of recording a false DELETED.
      try {
        const objectKey =
          getS3KeyFromMetadata(document.metadata) ??
          extractKeyFromUrl(document.fileUrl);

        if (objectKey) {
          const destroyed = await deleteByKey(objectKey);
          if (!destroyed) {
            failedCount++;
            errors.push(
              `S3 object not removed for document ${document.id}; row kept ACTIVE`
            );
            continue;
          }
        }

        await transaction(async (tx) => {
          await leaveDocumentRepository.updateStatus(
            document.id,
            "DELETED",
            tx
          );

          await auditService.record(
            AUDIT_ACTION.DELETE,
            AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
            document.leaveRequestId ?? document.id,
            actor,
            {
              action: "DOCUMENT_RETENTION_DELETED",
              documentId: document.id,
              fileName: document.fileName,
              retentionYears: DOCUMENT_RETENTION_YEARS,
            },
            tx
          );
        });

        deletedCount++;
      } catch (error) {
        failedCount++;
        errors.push(
          `Failed to retire document ${document.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (batch.length < DOCUMENT_RETENTION_BATCH_SIZE) break;
  }

  if (errors.length > 0) {
    logger.error("Document retention job reported errors", {
      job: JOB,
      deleted: deletedCount,
      failed: failedCount,
      errors,
    });
  }

  return {
    job: JOB,
    deleted: deletedCount,
    failed: failedCount,
    cutoff: cutoff.toISOString(),
    errors,
  };
}
