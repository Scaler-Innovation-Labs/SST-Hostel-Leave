import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import {
  checkParentOverride,
  getApprovalAuditMeta,
  handleNextStep,
  updateApprovalAndAudit,
} from "@/services/leave/shared-approval.service";

export type ApproveLeaveResult = {
  leaveId: string;
  decision: string;
  stepKey: string | null;
  stepOrder: number | null;
  newStatus: string | null;
  warning?: string;
  requiresConfirmation?: boolean;
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

    if (dto.decision === LEAVE_APPROVAL_DECISION.APPROVED) {
      const leaveType = await leaveTypeRepository.findById(leaveInTx.leaveTypeId, tx);
      const isSpecial = (leaveType?.uiConfig as Record<string, unknown> | null)?.isSpecial === true;
      if (isSpecial && dto.documentsVerified !== true) {
        throw new ValidationError("Documents must be verified before approving a special leave");
      }
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

    const override = checkParentOverride(current, dto, currentUser);
    if (override?.requiresConfirmation) {
      return { leaveId, ...override };
    }

    await updateApprovalAndAudit(
      current,
      dto.decision,
      currentUser.id,
      dto.comments,
      AUDIT_ACTION.APPROVE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      getApprovalAuditMeta(leaveId, dto.comments, override!.isParentOverride),
      tx
    );

    const nextResult = await handleNextStep(
      leaveId,
      leaveApprovals.leaveRequestId,
      current.stepOrder,
      (id, stepKey, stepOrder, t) => leaveRepository.updateCurrentStep(id, stepKey, stepOrder, t),
      (next) => ({
        leaveId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        stepKey: next.stepKey,
        stepOrder: next.stepOrder,
        newStatus: null,
      }),
      tx
    );

    if (nextResult) return nextResult;

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
