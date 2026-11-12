import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

import { recordMovement } from "./record-movement.service";

export type MarkOverdueInput = {
  studentId: string;
  leaveRequestId?: string;
  currentUser: CurrentUser;
};

export type MarkOverdueResult = {
  movementEventId: string;
  studentId: string;
  newState: string;
};

export async function markOverdue(
  input: MarkOverdueInput
): Promise<MarkOverdueResult> {
  const student = await studentRepository.findById(input.studentId);

  if (!student) {
    throw new NotFoundError("Student");
  }

  // Hostel-scope guard: a scoped ADMIN must only mutate students in their
  // own hostel; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(input.currentUser, input.studentId);

  const currentState = student.currentLocationState;

  if (
    currentState !== MOVEMENT_STATE.CHECKED_OUT &&
    currentState !== MOVEMENT_STATE.OUTSIDE_HOSTEL
  ) {
    throw new ConflictError(
      `Cannot mark overdue from state: ${currentState}`
    );
  }

  return await transaction(async (tx) => {
    let targetQrPassId: string | undefined;

    if (input.leaveRequestId) {
      const hasActivePendingExt =
        await leaveExtensionRepository.hasActivePendingExtension(input.leaveRequestId, new Date(), tx);
      if (hasActivePendingExt) {
        throw new ConflictError(
          "Cannot mark overdue: an active extension request is pending decision"
        );
      }

      const activePass = await qrPassRepository.findByLeaveRequestId(input.leaveRequestId, tx);
      if (activePass) {
        targetQrPassId = activePass.id;
      }

      const leave = await leaveRepository.findById(input.leaveRequestId, tx);
      if (leave && canTransition(leave.status, LEAVE_ACTION.MARK_OVERDUE)) {
        const nextState = getNextState(leave.status, LEAVE_ACTION.MARK_OVERDUE);
        await leaveRepository.updateById(
          leave.id,
          {
            status: nextState,
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
            newStatus: nextState,
            action: LEAVE_ACTION.MARK_OVERDUE,
          },
          tx
        );

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_OVERDUE,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: leave.id,
          payload: {
            leaveId: leave.id,
            studentId: input.studentId,
          },
        }, tx);
      }
    }

    const movementEvent = await recordMovement({
      studentId: input.studentId,
      leaveRequestId: input.leaveRequestId ?? undefined,
      qrPassId: targetQrPassId ?? undefined,
      fromState: currentState,
      toState: MOVEMENT_STATE.OVERDUE,
      eventType: MOVEMENT_EVENT.AUTO_OVERDUE,
      movementMethod: MOVEMENT_METHOD.SYSTEM,
      recordedBy: input.currentUser.id,
      isManualOverride: true,
      dbClient: tx,
    });

    return {
      movementEventId: movementEvent.id,
      studentId: input.studentId,
      newState: MOVEMENT_STATE.OVERDUE,
    };
  });
}
