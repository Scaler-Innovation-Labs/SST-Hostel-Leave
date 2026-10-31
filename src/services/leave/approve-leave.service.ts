import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { requireRejectionAuthorization } from "@/lib/auth/authorization";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { issueQrPassForApprovedLeave } from "@/services/leave/qr-pass-lifecycle.service";
import {
  checkParentOverride,
  getApprovalAuditMeta,
  selectCurrentPendingApproval,
  updateApprovalAndAudit,
} from "@/services/leave/shared-approval.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";
import { activateWorkflowStep } from "@/services/workflow/workflow-activation.service";

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
  currentUser: CurrentUser
): Promise<ApproveLeaveResult> {
  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    await assertCanAccessLeave(currentUser, leaveInTx);

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

    const current = selectCurrentPendingApproval(
      pending,
      leaveInTx.currentStepKey,
      leaveInTx.currentStepOrder,
    );

    let isParentOverride = false;
    if (dto.decision === LEAVE_APPROVAL_DECISION.REJECTED) {
      requireRejectionAuthorization(current, currentUser);
    } else {
      const override = checkParentOverride(current, dto, currentUser);
      if (override?.requiresConfirmation) {
        const { isParentOverride: _, ...overrideFields } = override;
        return { leaveId, ...overrideFields } as ApproveLeaveResult;
      }
      isParentOverride = override?.isParentOverride ?? false;
    }

    await updateApprovalAndAudit(
      current,
      dto.decision,
      currentUser.id,
      dto.comments,
      dto.decision === LEAVE_APPROVAL_DECISION.REJECTED ? AUDIT_ACTION.REJECT : AUDIT_ACTION.APPROVE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      getApprovalAuditMeta(leaveId, dto.comments, isParentOverride),
      tx
    );

    if (dto.decision === LEAVE_APPROVAL_DECISION.REJECTED) {
      const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.REJECT);

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

      const rejectedBy: "PARENT" | "POC" | "ADMIN" =
        currentUser.roles.includes(ROLES.SUPER_ADMIN) || currentUser.roles.includes(ROLES.ADMIN)
          ? "ADMIN"
          : current.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL
            ? "POC"
            : "ADMIN";

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leaveId,
        payload: {
          leaveId,
          studentId: leaveInTx.studentId,
          decision: LEAVE_APPROVAL_DECISION.REJECTED,
          // POC-step rejections use the POC wording ("declined by {POC Name}") only
          // when actually rejected by a POC; admin/superadmin actions keep the admin wording.
          rejectedBy,
          comments: dto.comments ?? "",
        },
      }, tx);

      return {
        leaveId,
        decision: LEAVE_APPROVAL_DECISION.REJECTED,
        stepKey: null,
        stepOrder: null,
        newStatus: nextState,
      };
    }

    const nextApproval = await leaveApprovalRepository.findNextByEntityAndDecision(
      leaveId,
      leaveApprovals.leaveRequestId,
      current.stepOrder,
      LEAVE_APPROVAL_DECISION.PENDING,
      tx
    );

    if (nextApproval) {
      await leaveRepository.updateCurrentStep(leaveId, nextApproval.stepKey, nextApproval.stepOrder, tx);

      await activateWorkflowStep({
        leave: leaveInTx,
        step: nextApproval,
        dbClient: tx,
      });

      return {
        leaveId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        stepKey: nextApproval.stepKey,
        stepOrder: nextApproval.stepOrder,
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

    // ONE token per approved leave, generated once and stable for its
    // lifetime. The raw token is stored encrypted on the pass row so the
    // student app can render the SAME scannable QR; it is never published
    // into outbox payloads.
    await issueQrPassForApprovedLeave(leaveInTx, tx);

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        comments: dto.comments ?? "",
        ccEmails: dto.ccEmails ?? [],
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
