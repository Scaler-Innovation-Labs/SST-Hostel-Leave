import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { requireRole } from "@/lib/auth/authorization";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type OverrideMode = "ONE_STEP" | "ALL";

export type SuperadminOverrideResult = {
  leaveId: string;
  mode: OverrideMode;
  approvalsOverridden: number;
  newStatus: string | null;
  stepKey: string | null;
  stepOrder: number | null;
};

export async function superadminOverrideLeave(
  leaveId: string,
  mode: OverrideMode,
  currentUser: CurrentUser,
  comments?: string,
): Promise<SuperadminOverrideResult> {
  // Defense in depth: the route already gates this to SUPER_ADMIN, but the
  // service enforces it too so no future caller can invoke the override
  // with a lesser privilege (e.g. a hostel-scoped ADMIN).
  requireRole(currentUser, ROLES.SUPER_ADMIN);

  const userId = currentUser.id;

  return await transaction(async (tx) => {
    const leave = await leaveRepository.findByIdForUpdate(leaveId, tx);
    if (!leave) throw new NotFoundError("LeaveRequest");
    if (leave.status !== LEAVE_REQUEST_STATUS.PENDING && leave.status !== LEAVE_REQUEST_STATUS.REJECTED) {
      throw new ConflictError("Leave is not in a state that can be overridden");
    }

    const isRejectedRecovery = leave.status === LEAVE_REQUEST_STATUS.REJECTED;

    // Fetch all approval steps ordered by stepOrder
    const allSteps = await leaveApprovalRepository.findByLeaveRequestId(leaveId, tx);

    if (allSteps.length === 0) {
      throw new ConflictError("No approvals found for this leave");
    }

    // Actionable: pending approvals, plus the rejected step when recovering from rejection
    const actionable = allSteps.filter(
      (s) => s.decision === LEAVE_APPROVAL_DECISION.PENDING || (isRejectedRecovery && s.decision === LEAVE_APPROVAL_DECISION.REJECTED),
    );

    if (actionable.length === 0) {
      throw new ConflictError("No approvals to override");
    }

    // Parent consent is the point of the SMS-link step — an override must
    // never silently force through a step the parent rejected or never saw.
    // Parent steps carry approverParentId; overriding them would defeat the
    // whole parent-approval audit trail.
    if (actionable.some((s) => s.approverParentId !== null)) {
      throw new AuthorizationError(
        "Parent approval steps cannot be overridden — resolve them via the parent approval link"
      );
    }

    // When recovering from rejection, revert leave status to PENDING
    if (isRejectedRecovery) {
      await leaveRepository.updateById(leaveId, { status: LEAVE_REQUEST_STATUS.PENDING }, tx);
    }

    const idsToProcess = mode === "ONE_STEP" ? [actionable[0]!.id] : actionable.map((s) => s.id);

    for (const approvalId of idsToProcess) {
      const updated = await leaveApprovalRepository.updateDecisionById(
        approvalId,
        LEAVE_APPROVAL_DECISION.APPROVED,
        userId,
        comments,
        new Date(),
        tx,
        LEAVE_APPROVAL_SOURCE.MANUAL,
      );

      if (!updated) continue;

      await auditService.record(AUDIT_ACTION.OVERRIDE, AUDIT_ENTITY_TYPE.LEAVE_APPROVAL, approvalId, userId, { leaveRequestId: leaveId, mode, comments }, tx);
    }

    // After override, check for remaining pending steps
    const remainingPending = await leaveApprovalRepository.findByEntityAndDecision(leaveId, leaveApprovals.leaveRequestId, LEAVE_APPROVAL_DECISION.PENDING, tx);

    if (remainingPending.length > 0) {
      const nextStep = remainingPending[0]!;
      await leaveRepository.updateCurrentStep(leaveId, nextStep.stepKey, nextStep.stepOrder, tx);

      // A later workflow step is now current after the override — notify the
      // next approver via the approval queue rules.
      await outboxService.publish(
        {
          eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVAL_REQUIRED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: leaveId,
          payload: {
            leaveId,
            studentId: leave.studentId,
            stepKey: nextStep.stepKey,
            stepOrder: nextStep.stepOrder,
            overridden: true,
            mode,
          },
        },
        tx,
      );

      return {
        leaveId,
        mode,
        approvalsOverridden: idsToProcess.length,
        newStatus: null,
        stepKey: nextStep.stepKey,
        stepOrder: nextStep.stepOrder,
      };
    }

    // All steps processed — final approval
    await leaveRepository.updateById(leaveId, { status: LEAVE_REQUEST_STATUS.APPROVED, approvedAt: new Date(), currentStepKey: null, currentStepOrder: null }, tx);

    await auditService.record(AUDIT_ACTION.UPDATE, AUDIT_ENTITY_TYPE.LEAVE_REQUEST, leaveId, userId, { oldStatus: leave.status, newStatus: LEAVE_REQUEST_STATUS.APPROVED, mode }, tx);

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leaveId,
        payload: { leaveId, studentId: leave.studentId, decision: LEAVE_APPROVAL_DECISION.APPROVED, overridden: true, mode },
      },
      tx,
    );

    return {
      leaveId,
      mode,
      approvalsOverridden: idsToProcess.length,
      newStatus: LEAVE_REQUEST_STATUS.APPROVED,
      stepKey: null,
      stepOrder: null,
    };
  });
}
