import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

import { recordMovement } from "./record-movement.service";

export type InvalidateQrInput = {
  qrPassId: string;
  recordedBy: string;
  reason?: string;
};

export type InvalidateQrResult = {
  qrPassId: string;
  movementEventId?: string;
};

export async function invalidateQrPass(
  input: InvalidateQrInput
): Promise<InvalidateQrResult> {
  const qrPass = await qrPassRepository.findById(input.qrPassId);

  if (!qrPass) {
    throw new NotFoundError("QRPass");
  }

  if (qrPass.status !== QR_STATUS.ACTIVE) {
    throw new ConflictError(
      `Cannot invalidate QR pass in status: ${qrPass.status}`
    );
  }

  return await transaction(async (tx) => {
    await qrPassRepository.invalidate(input.qrPassId, tx);

    const student = await studentRepository.findById(qrPass.studentId, tx);

    let movementEventId: string | undefined;

    if (student?.currentLocationState === MOVEMENT_STATE.APPROVED_LEAVE) {
      const movementEvent = await recordMovement({
        studentId: qrPass.studentId,
        leaveRequestId: qrPass.leaveRequestId,
        qrPassId: qrPass.id,
        fromState: MOVEMENT_STATE.APPROVED_LEAVE,
        toState: MOVEMENT_STATE.IN_HOSTEL,
        eventType: MOVEMENT_EVENT.QR_INVALIDATED,
        movementMethod: MOVEMENT_METHOD.SYSTEM,
        recordedBy: input.recordedBy,
        isManualOverride: true,
        overrideReason: input.reason,
        dbClient: tx,
      });
      movementEventId = movementEvent.id;
    }

    await auditService.record(
      AUDIT_ACTION.INVALIDATE,
      AUDIT_ENTITY_TYPE.QR_PASS,
      input.qrPassId,
      input.recordedBy,
      {
        reason: input.reason ?? null,
        leaveRequestId: qrPass.leaveRequestId,
        studentId: qrPass.studentId,
        movementEventId,
      },
      tx
    );

    return {
      qrPassId: input.qrPassId,
      movementEventId,
    };
  });
}
