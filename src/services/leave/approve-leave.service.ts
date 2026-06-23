import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { requireApprovalAuthorization } from "@/lib/auth/authorization";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ApproveLeaveResult = {
  leaveId: string;
  decision: string;
  stepKey: string | null;
  stepOrder: number | null;
  newStatus: string | null;
};

export async function approveLeave(
  leaveId: string,
  dto: ApproveLeaveDto,
  currentUser: { id: string; roles: string[] }
): Promise<ApproveLeaveResult> {
  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (leaveInTx.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError("Leave is not in a state that can be approved");
    }

    const pending =
      await leaveApprovalRepository.findByLeaveRequestAndDecision(
        leaveId,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (pending.length === 0) {
      throw new ConflictError("No pending approval");
    }

    const current = pending[0]!;

    requireApprovalAuthorization(current, currentUser);

    const updatedApproval =
      await leaveApprovalRepository.updateDecisionById(
        current.id,
        LEAVE_APPROVAL_DECISION.APPROVED,
        currentUser.id,
        dto.comments,
        new Date(),
        tx
      );

    if (!updatedApproval) {
      throw new ConflictError("Approval already processed");
    }

    await auditService.record(
      AUDIT_ACTION.APPROVE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      current.id,
      currentUser.id,
      {
        leaveRequestId: leaveId,
        comments: dto.comments,
      },
      tx
    );

    const next =
      await leaveApprovalRepository.findNextByDecision(
        leaveId,
        current.stepOrder,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (next) {
      await leaveRepository.updateCurrentStep(
        leaveId,
        next.stepKey,
        next.stepOrder,
        tx
      );

      return {
        leaveId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        stepKey: next.stepKey,
        stepOrder: next.stepOrder,
        newStatus: null,
      };
    }

    const nextState = getNextState(
      leaveInTx.status,
      LEAVE_ACTION.APPROVE
    );

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        approvedAt: new Date(),
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
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
      },
    }, tx);

    return {
      leaveId,
      decision: LEAVE_APPROVAL_DECISION.APPROVED,
      stepKey: null,
      stepOrder: null,
      newStatus: nextState,
    };
  });
}
