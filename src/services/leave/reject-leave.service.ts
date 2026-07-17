import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { requireApprovalAuthorization } from "@/lib/auth/authorization";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import {
  getApprovalAuditMeta,
  updateApprovalAndAudit,
} from "@/services/leave/shared-approval.service";

export type RejectLeaveResult = {
  leaveId: string;
  decision: string;
  stepKey: null;
  stepOrder: null;
  newStatus: string;
};

export async function rejectLeave(
  leaveId: string,
  dto: ApproveLeaveDto,
  currentUser: { id: string; roles: string[] }
): Promise<RejectLeaveResult> {
  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (leaveInTx.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError("Leave is not in a state that can be rejected");
    }

    const pending =
      await leaveApprovalRepository.findByEntityAndDecision(
        leaveId,
        leaveApprovals.leaveRequestId,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (pending.length === 0) {
      throw new ConflictError("No pending approval");
    }

    const current = pending[0]!;

    requireApprovalAuthorization(current, currentUser);

    await updateApprovalAndAudit(
      current,
      LEAVE_APPROVAL_DECISION.REJECTED,
      currentUser.id,
      dto.comments,
      AUDIT_ACTION.REJECT,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      getApprovalAuditMeta(leaveId, dto.comments, false),
      tx
    );

    const nextState = getNextState(
      leaveInTx.status,
      LEAVE_ACTION.REJECT
    );

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        rejectedAt: new Date(),
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
      eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        decision: LEAVE_APPROVAL_DECISION.REJECTED,
        reason: dto.comments ?? "",
      },
    }, tx);

    return {
      leaveId,
      decision: LEAVE_APPROVAL_DECISION.REJECTED,
      stepKey: null,
      stepOrder: null,
      newStatus: nextState,
    };
  });
}
