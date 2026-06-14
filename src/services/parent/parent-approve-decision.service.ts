import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import type { ParentDecisionDto } from "@/dto/parent/parent-decision.dto";
import { transaction } from "@/lib/db/transaction";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type ParentDecisionResult = {
  approvalId: string;
  decision: string;
};

export async function parentApproveDecision(
  rawToken: string,
  dto: ParentDecisionDto
): Promise<ParentDecisionResult> {
  const tokenHash = await sha256(rawToken);

  return await transaction(async (tx) => {
    const approval =
      await leaveApprovalRepository.findByParentApprovalToken(
        tokenHash,
        tx
      );

    if (!approval) {
      throw new NotFoundError("Approval");
    }

    if (!approval.parentApprovalVerifiedAt) {
      throw new ConflictError("OTP not verified");
    }

    if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
      throw new ConflictError("Approval already processed");
    }

    if (!approval.leaveRequestId) {
      throw new NotFoundError("LeaveRequest");
    }

    const updatedApproval =
      await leaveApprovalRepository.updateParentDecision(
        approval.id,
        approval.approverParentId ?? "",
        dto.decision as LeaveApprovalDecision,
        dto.comments,
        tx
      );

    if (!updatedApproval) {
      throw new ConflictError("Approval already processed");
    }

    await auditService.record(
      dto.decision === LEAVE_APPROVAL_DECISION.APPROVED
        ? AUDIT_ACTION.APPROVE
        : AUDIT_ACTION.REJECT,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      approval.id,
      approval.approverParentId ?? "",
      {
        leaveRequestId: approval.leaveRequestId,
        comments: dto.comments,
        approvalSource: LEAVE_APPROVAL_SOURCE.SMS,
      },
      tx
    );

    if (
      dto.decision === LEAVE_APPROVAL_DECISION.REJECTED
    ) {
      await leaveRepository.updateById(
        approval.leaveRequestId,
        {
          status: LEAVE_REQUEST_STATUS.REJECTED,
          rejectedAt: new Date(),
          currentStepKey: null,
          currentStepOrder: null,
        },
        tx
      );

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: approval.leaveRequestId,
        payload: {
          leaveRequestId: approval.leaveRequestId,
        },
      }, tx);
    } else if (
      dto.decision === LEAVE_APPROVAL_DECISION.APPROVED
    ) {
      const next =
        await leaveApprovalRepository.findNextByDecision(
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
          {
            status: LEAVE_REQUEST_STATUS.APPROVED,
            approvedAt: new Date(),
            currentStepKey: null,
            currentStepOrder: null,
          },
          tx
        );

        await auditService.record(
          AUDIT_ACTION.UPDATE,
          AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
          approval.leaveRequestId,
          approval.approverParentId ?? "",
          {
            oldStatus: LEAVE_REQUEST_STATUS.PENDING,
            newStatus: LEAVE_REQUEST_STATUS.APPROVED,
          },
          tx
        );

        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: approval.leaveRequestId,
          payload: {
            leaveRequestId: approval.leaveRequestId,
          },
        }, tx);
      }
    }

    return {
      approvalId: approval.id,
      decision: dto.decision,
    };
  });
}

