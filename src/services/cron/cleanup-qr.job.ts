import { type ActingRef, systemActor } from "@/constants/audit/actor";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { transaction } from "@/lib/db/transaction";
import { logger } from "@/lib/logger";
import { auditService } from "@/services/audit/audit.service";

const BATCH_SIZE = 100;
const JOB = "cleanup-qr";

export type CleanupQrJobResult = {
  job: string;
  expired: number;
  errors: string[];
};

/**
 * QR retirement job: ACTIVE passes whose window closed and that were never
 * used for exit are marked EXPIRED.
 *
 * Two properties this pass must hold:
 *
 * - A pass is retired in the same transaction as its audit record, so a
 *   pass can never be expired silently (an unwritable audit row rolls the
 *   retirement back and the pass is retried by a later run).
 * - One failing pass cannot abort the batch, and failures are reported
 *   rather than swallowed, so the caller can fail the cron run visibly.
 */
export async function runCleanupQrJob(
  actor: ActingRef = systemActor(JOB)
): Promise<CleanupQrJobResult> {
  const now = new Date();
  const errors: string[] = [];
  // A pass whose retirement failed stays ACTIVE and would be returned by the
  // next query. Remember what this run already tried so a persistent failure
  // cannot spin the batch loop forever.
  const attempted = new Set<string>();
  let expiredCount = 0;

  // Process in bounded batches so a large backlog cannot starve the worker.
  while (true) {
    const batch = await qrPassRepository.findExpired(
      now,
      undefined,
      BATCH_SIZE
    );

    const expired = batch.filter((pass) => !attempted.has(pass.id));

    if (expired.length === 0) {
      break;
    }

    for (const pass of expired) {
      attempted.add(pass.id);

      try {
        await transaction(async (tx) => {
          await qrPassRepository.updateStatus(pass.id, QR_STATUS.EXPIRED, tx);

          await auditService.record(
            AUDIT_ACTION.UPDATE,
            AUDIT_ENTITY_TYPE.QR_PASS,
            pass.id,
            actor,
            {
              oldStatus: QR_STATUS.ACTIVE,
              newStatus: QR_STATUS.EXPIRED,
              expiredAt: now.toISOString(),
              leaveRequestId: pass.leaveRequestId,
              studentId: pass.studentId,
            },
            tx
          );
        });

        expiredCount++;
      } catch (error) {
        errors.push(
          `Failed to expire QR pass ${pass.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (batch.length < BATCH_SIZE) {
      break;
    }
  }

  if (errors.length > 0) {
    logger.error("QR cleanup job reported errors", {
      job: JOB,
      expired: expiredCount,
      failed: errors.length,
      errors,
    });
  }

  return {
    job: JOB,
    expired: expiredCount,
    errors,
  };
}
