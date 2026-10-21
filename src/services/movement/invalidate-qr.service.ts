import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

import { recordMovement } from "./record-movement.service";

export type InvalidateQrInput = {
  qrPassId: string;
  currentUser: CurrentUser;
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

  // Scope-aware: students may invalidate only their own passes; hostel-scoped
  // staff only passes for students in their hostels.
  await assertCanAccessLeave(input.currentUser, { studentId: qrPass.studentId });

  const recordedBy = input.currentUser.id;

  if (qrPass.status !== QR_STATUS.ACTIVE) {
    throw new ConflictError(
      `Cannot invalidate QR pass in status: ${qrPass.status}`
    );
  }

  // Contract T13: only a pass that is still usable-for-exit (no open
  // movement session) may be revoked. Invalidating after an exit would strip
  // the student's return credential while they are outside.
  if (qrPass.firstScanAt) {
    throw new ConflictError(
      "Cannot invalidate a QR pass with an open movement session"
    );
  }

  return await transaction(async (tx) => {
    const passInTx = await qrPassRepository.findById(input.qrPassId, tx);

    if (!passInTx || passInTx.status !== QR_STATUS.ACTIVE) {
      throw new ConflictError("QR pass is no longer active");
    }

    if (passInTx.firstScanAt) {
      throw new ConflictError(
        "Cannot invalidate a QR pass with an open movement session"
      );
    }

    // Guarded: if an exit scan won the race after our re-read, this returns
    // null and we must report a conflict instead of revoking a live session.
    const invalidated = await qrPassRepository.invalidate(
      input.qrPassId,
      tx
    );

    if (!invalidated) {
      throw new ConflictError(
        "QR pass was concurrently used or invalidated"
      );
    }

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
        recordedBy,
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
      recordedBy,
      {
        reason: input.reason ?? null,
        leaveRequestId: qrPass.leaveRequestId,
        studentId: qrPass.studentId,
        movementEventId,
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.QR_INVALIDATED,
      aggregateType: AGGREGATE_TYPE.QR_PASS,
      aggregateId: qrPass.id,
      payload: {
        studentId: qrPass.studentId,
        leaveRequestId: qrPass.leaveRequestId,
        qrPassId: qrPass.id,
      },
    }, tx);

    return {
      qrPassId: input.qrPassId,
      movementEventId,
    };
  });
}
