import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import {
  DOCUMENT_RETENTION_BATCH_SIZE,
  DOCUMENT_RETENTION_YEARS,
} from "@/constants/leave/document-retention";
import { leaveDocumentRepository } from "@/db/repositories/leave/leave-document.repository";
import { deleteByPublicId, extractPublicIdFromUrl } from "@/lib/cloudinary";
import { auditService } from "@/services/audit/audit.service";

/**
 * Document retention job: deletes Cloudinary files whose owning leave
 * reached a terminal state more than DOCUMENT_RETENTION_YEARS ago and
 * soft-deletes the DB row so the audit trail survives.
 *
 * Storage math (per audit §35): ~40 GB/year at full scale if documents
 * live forever — this job caps that growth.
 */
export async function runDocumentRetentionJob(
  currentUser: { id: string } = { id: "SYSTEM" }
): Promise<{ job: string; deleted: number; cutoff: string }> {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - DOCUMENT_RETENTION_YEARS);

  let deletedCount = 0;

  // Bounded batches: a large first-run backlog must not starve the worker
  // or hammer Cloudinary rate limits.
  while (true) {
    const expired = await leaveDocumentRepository.findExpiredForRetention(
      cutoff,
      DOCUMENT_RETENTION_BATCH_SIZE
    );

    if (expired.length === 0) break;

    for (const document of expired) {
      const publicId =
        (
          document.metadata as { cloudinaryPublicId?: string } | null
        )?.cloudinaryPublicId ?? extractPublicIdFromUrl(document.fileUrl);

      if (publicId) {
        const resourceType = document.mimeType?.startsWith("image/")
          ? "image"
          : "raw";
        await deleteByPublicId(publicId, resourceType);
      }

      await leaveDocumentRepository.updateStatus(document.id, "DELETED");

      await auditService.record(
        AUDIT_ACTION.DELETE,
        AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
        document.leaveRequestId ?? document.id,
        currentUser.id,
        {
          action: "DOCUMENT_RETENTION_DELETED",
          documentId: document.id,
          fileName: document.fileName,
          retentionYears: DOCUMENT_RETENTION_YEARS,
        }
      );

      deletedCount++;
    }

    if (expired.length < DOCUMENT_RETENTION_BATCH_SIZE) break;
  }

  return {
    job: "document-retention",
    deleted: deletedCount,
    cutoff: cutoff.toISOString(),
  };
}
