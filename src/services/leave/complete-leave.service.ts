import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import type { CompleteLeaveDto } from "@/dto/leave/complete-leave.dto";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type CompleteLeaveResult = {
  leaveId: string;
  newStatus: string;
  completedAt: Date;
};

export async function completeLeave(
  leaveId: string,
  dto: CompleteLeaveDto,
  currentUser: { id: string }
): Promise<CompleteLeaveResult> {
  const leave = await leaveRepository.findById(leaveId);

  if (!leave) throw new NotFoundError("LeaveRequest");

  if (!canTransition(leave.status, LEAVE_ACTION.COMPLETE)) {
    throw new ConflictError(
      `Cannot complete leave in ${leave.status} status`
    );
  }

  return await db.transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (!canTransition(leaveInTx.status, LEAVE_ACTION.COMPLETE)) {
      throw new ConflictError(
        `Cannot complete leave in ${leaveInTx.status} status`
      );
    }

    const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.COMPLETE);
    const completedAt = new Date();

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        completedAt,
        actualReturnAt: dto.actualReturnAt
          ? new Date(dto.actualReturnAt)
          : completedAt,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: leaveInTx.status,
        newStatus: nextState,
        completedAt: completedAt.toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_COMPLETED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        completedAt: completedAt.toISOString(),
      },
    }, tx);

    return {
      leaveId,
      newStatus: nextState,
      completedAt,
    };
  });
}

