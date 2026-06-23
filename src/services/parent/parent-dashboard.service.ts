import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError,NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export const parentDashboardService = {
  async getStats(parentId: string) {
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      leaveApprovalRepository.countByParentIdAndDecision(parentId, LEAVE_APPROVAL_DECISION.PENDING),
      leaveApprovalRepository.countByParentIdAndDecision(parentId, LEAVE_APPROVAL_DECISION.APPROVED),
      leaveApprovalRepository.countByParentIdAndDecision(parentId, LEAVE_APPROVAL_DECISION.REJECTED),
    ]);

    return { pendingCount, approvedCount, rejectedCount };
  },

  async getPendingApprovals(parentId: string) {
    return leaveApprovalRepository.findPendingByParentId(parentId);
  },

  async getApprovalDetail(approvalId: string, parentId: string) {
    const approval = await leaveApprovalRepository.findById(approvalId);

    if (!approval) throw new NotFoundError("Approval");
    if (approval.approverParentId !== parentId) throw new NotFoundError("Approval");

    return approval;
  },

  async submitDecision(
    approvalId: string,
    parentId: string,
    decision: "APPROVED" | "REJECTED",
    comments?: string
  ) {
    return await transaction(async (tx) => {
      const approval = await leaveApprovalRepository.findById(approvalId, tx);

      if (!approval) throw new NotFoundError("Approval");
      if (approval.approverParentId !== parentId) throw new ConflictError("Not your approval");

      await leaveApprovalRepository.updateParentDecision(
        approvalId,
        parentId,
        decision,
        comments,
        tx,
        LEAVE_APPROVAL_SOURCE.PORTAL,
      );

      await auditService.record(
        decision === "APPROVED" ? AUDIT_ACTION.APPROVE : AUDIT_ACTION.REJECT,
        AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
        approvalId,
        parentId,
        { leaveRequestId: approval.leaveRequestId, comments },
        tx
      );

      if (!approval.leaveRequestId) throw new NotFoundError("LeaveRequest");

      const now = new Date();

      if (decision === "REJECTED") {
        await leaveRepository.updateById(
          approval.leaveRequestId,
          { status: LEAVE_REQUEST_STATUS.REJECTED, rejectedAt: now, currentStepKey: null, currentStepOrder: null },
          tx
        );

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: approval.leaveRequestId,
          payload: { leaveRequestId: approval.leaveRequestId },
        }, tx);
      } else {
        const next = await leaveApprovalRepository.findNextByDecision(
          approval.leaveRequestId,
          approval.stepOrder,
          LEAVE_APPROVAL_DECISION.PENDING,
          tx
        );

        if (next) {
          await leaveRepository.updateCurrentStep(
            approval.leaveRequestId,
            next.stepKey,
            next.stepOrder,
            tx
          );
        } else {
          await leaveRepository.updateById(
            approval.leaveRequestId,
            { status: LEAVE_REQUEST_STATUS.APPROVED, approvedAt: now, currentStepKey: null, currentStepOrder: null },
            tx
          );

          await outboxService.publish({
            eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
            aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
            aggregateId: approval.leaveRequestId,
            payload: { leaveRequestId: approval.leaveRequestId },
          }, tx);
        }
      }

      return { approvalId, decision };
    });
  },

  async getHistory(parentId: string) {
    return leaveApprovalRepository.findHistoryByParentId(parentId);
  },
};
