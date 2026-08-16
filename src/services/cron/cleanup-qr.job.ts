import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { auditService } from "@/services/audit/audit.service";

const BATCH_SIZE = 100;

export async function runCleanupQrJob(
  currentUser: { id: string } = { id: "SYSTEM" }
): Promise<{ job: string; expired: number }> {
  const now = new Date();
  let expiredCount = 0;

  // Process in bounded batches so a large backlog cannot starve the worker.
  while (true) {
    const expired = await qrPassRepository.findExpired(now, undefined, BATCH_SIZE);

    if (expired.length === 0) {
      break;
    }

    for (const pass of expired) {
      await qrPassRepository.updateStatus(pass.id, QR_STATUS.EXPIRED);

      await auditService.record(
        AUDIT_ACTION.UPDATE,
        AUDIT_ENTITY_TYPE.QR_PASS,
        pass.id,
        currentUser.id,
        {
          oldStatus: QR_STATUS.ACTIVE,
          newStatus: QR_STATUS.EXPIRED,
          expiredAt: now.toISOString(),
          leaveRequestId: pass.leaveRequestId,
          studentId: pass.studentId,
        }
      );

      expiredCount++;
    }

    if (expired.length < BATCH_SIZE) {
      break;
    }
  }

  return {
    job: "cleanup-qr",
    expired: expiredCount,
  };
}
