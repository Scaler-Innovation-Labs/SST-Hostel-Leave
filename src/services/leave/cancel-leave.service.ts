import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CancelLeaveDto } from "@/dto/leave/cancel-leave.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type CancelLeaveResult = {
  leaveId: string;
  newStatus: string;
  qrInvalidated: boolean;
};

export async function cancelLeave(
  leaveId: string,
  dto: CancelLeaveDto,
  currentUser: { id: string }
): Promise<CancelLeaveResult> {
  const leave = await leaveRepository.findById(leaveId);

  if (!leave) throw new NotFoundError("LeaveRequest");

  if (!canTransition(leave.status, LEAVE_ACTION.CANCEL)) {
    throw new ConflictError(
      `Cannot cancel leave in ${leave.status} status`
    );
  }

  if (leave.status === LEAVE_REQUEST_STATUS.APPROVED) {
    const student = await studentRepository.findById(leave.studentId);

    if (!student) throw new NotFoundError("Student");

    if (
      student.currentLocationState !== MOVEMENT_STATE.IN_HOSTEL &&
      student.currentLocationState !== MOVEMENT_STATE.APPROVED_LEAVE
    ) {
      throw new ConflictError(
        "Cannot cancel active leave after student has exited"
      );
    }
  }

  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (!canTransition(leaveInTx.status, LEAVE_ACTION.CANCEL)) {
      throw new ConflictError(
        `Cannot cancel leave in ${leaveInTx.status} status`
      );
    }

    if (leaveInTx.status === LEAVE_REQUEST_STATUS.APPROVED) {
      const student = await studentRepository.findById(
        leaveInTx.studentId,
        tx
      );

      if (!student) throw new NotFoundError("Student");

      if (
        student.currentLocationState !== MOVEMENT_STATE.IN_HOSTEL &&
        student.currentLocationState !== MOVEMENT_STATE.APPROVED_LEAVE
      ) {
        throw new ConflictError(
          "Cannot cancel active leave after student has exited"
        );
      }
    }

    const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.CANCEL);

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        cancelledAt: new Date(),
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    // Mark all pending approvals as cancelled
    await leaveApprovalRepository.updateDecisionByLeaveRequestId(
      leaveId,
      LEAVE_APPROVAL_DECISION.CANCELLED,
      new Date(),
      tx
    );

    let qrInvalidated = false;

    if (leaveInTx.status === LEAVE_REQUEST_STATUS.APPROVED) {
      const qrPass = await qrPassRepository.findByLeaveRequestId(
        leaveId,
        tx
      );

      if (qrPass && qrPass.status === QR_STATUS.ACTIVE) {
        await qrPassRepository.invalidate(qrPass.id, tx);
        qrInvalidated = true;
      }

      // Movement transition (if applicable) handled asynchronously by outbox handler
    }

    await auditService.record(
      AUDIT_ACTION.CANCEL,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: leaveInTx.status,
        newStatus: nextState,
        reason: dto.reason,
        qrInvalidated,
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_CANCELLED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        reason: dto.reason ?? "",
      },
    }, tx);

    return {
      leaveId,
      newStatus: nextState,
      qrInvalidated,
    };
  });
}

