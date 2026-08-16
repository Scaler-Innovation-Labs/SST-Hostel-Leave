import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

import { recordMovement } from "./record-movement.service";

export type ManualReturnInput = {
  studentId: string;
  currentUser: CurrentUser;
  reason?: string;
};

export type ManualReturnResult = {
  movementEventId: string;
  studentId: string;
  newState: string;
  /** The leave completed by this return, if an open QR session existed. */
  leaveId?: string | null;
};

export async function manualReturn(
  input: ManualReturnInput
): Promise<ManualReturnResult> {
  const student = await studentRepository.findById(input.studentId);

  if (!student) {
    throw new NotFoundError("Student");
  }

  // Hostel-scope guard: a scoped ADMIN/POC must only mutate students in
  // their own hostel; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(input.currentUser, input.studentId);

  const currentState = student.currentLocationState;

  if (
    currentState !== MOVEMENT_STATE.CHECKED_OUT &&
    currentState !== MOVEMENT_STATE.OUTSIDE_HOSTEL &&
    currentState !== MOVEMENT_STATE.OVERDUE
  ) {
    throw new ConflictError(
      `Cannot perform manual return from state: ${currentState}`
    );
  }

  // Contract §2: the open movement session is the pass with firstScanAt set
  // and closedAt null. T9 closes that session and completes its leave —
  // otherwise the pass stays ACTIVE-and-open forever, a phantom session the
  // dashboard and overdue reports would keep showing.
  const openSession = await qrPassRepository.findOpenSessionPassForStudent(
    input.studentId
  );

  const completedAt = new Date();

  return await transaction(async (tx) => {
    const movementEvent = await recordMovement({
      studentId: input.studentId,
      leaveRequestId: openSession?.leaveRequestId ?? undefined,
      qrPassId: openSession?.id ?? undefined,
      fromState: currentState,
      toState: MOVEMENT_STATE.IN_HOSTEL,
      eventType: MOVEMENT_EVENT.MANUAL_RETURN,
      movementMethod: MOVEMENT_METHOD.MANUAL,
      recordedBy: input.currentUser.id,
      isManualOverride: true,
      overrideReason: input.reason,
      dbClient: tx,
    });

    let leaveId: string | null = null;

    if (openSession) {
      // Close the credential — the session is over (status USED, closedAt).
      await qrPassRepository.markAsClosed(openSession.id, tx);

      // Complete the leave that owned the session: actualReturnAt = now.
      const leave = await leaveRepository.findById(
        openSession.leaveRequestId,
        tx
      );

      if (leave && canTransition(leave.status, LEAVE_ACTION.COMPLETE)) {
        leaveId = leave.id;

        await leaveRepository.updateById(
          leave.id,
          {
            status: LEAVE_REQUEST_STATUS.COMPLETED,
            completedAt,
            actualReturnAt: completedAt,
            currentStepKey: null,
            currentStepOrder: null,
          },
          tx
        );

        await auditService.record(
          AUDIT_ACTION.UPDATE,
          AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
          leave.id,
          input.currentUser.id,
          {
            oldStatus: leave.status,
            newStatus: LEAVE_REQUEST_STATUS.COMPLETED,
            completedAt: completedAt.toISOString(),
            method: "MANUAL_RETURN",
          },
          tx
        );

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_COMPLETED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: leave.id,
          payload: {
            leaveId: leave.id,
            studentId: input.studentId,
            completedAt: completedAt.toISOString(),
            method: "MANUAL_RETURN",
          },
        }, tx);
      }
    }

    return {
      movementEventId: movementEvent.id,
      studentId: input.studentId,
      newState: MOVEMENT_STATE.IN_HOSTEL,
      leaveId,
    };
  });
}
