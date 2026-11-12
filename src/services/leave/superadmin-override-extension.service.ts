import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { requireAnyRole } from "@/lib/auth/authorization";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { assertNoConflictingOverlap } from "@/services/leave/overlap-guard.service";
import { extendQrPassWindow } from "@/services/leave/qr-pass-lifecycle.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export type OverrideMode = "ONE_STEP" | "ALL";

export type SuperadminOverrideExtensionResult = {
  extensionId: string;
  leaveRequestId: string;
  mode: OverrideMode;
  approvalsOverridden: number;
  newStatus: string | null;
  stepKey: string | null;
  stepOrder: number | null;
};

export async function superadminOverrideExtension(
  extensionId: string,
  mode: OverrideMode,
  currentUser: CurrentUser,
  comments?: string
): Promise<SuperadminOverrideExtensionResult> {
  requireAnyRole(currentUser, [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

  const userId = currentUser.id;

  return await transaction(async (tx) => {
    const extension = await leaveExtensionRepository.findByIdForUpdate(extensionId, tx);
    if (!extension) throw new NotFoundError("LeaveExtension");

    const leave = await leaveRepository.findByIdForUpdate(extension.leaveRequestId, tx);
    if (!leave) throw new NotFoundError("LeaveRequest");

    await assertCanAccessLeave(currentUser, leave);

    if (
      extension.status !== LEAVE_REQUEST_STATUS.PENDING &&
      extension.status !== LEAVE_REQUEST_STATUS.REJECTED
    ) {
      throw new ConflictError("Extension is not in a state that can be overridden");
    }

    if (
      leave.status !== LEAVE_REQUEST_STATUS.APPROVED &&
      leave.status !== LEAVE_REQUEST_STATUS.OVERDUE
    ) {
      throw new ConflictError(
        `Cannot approve an extension for a leave in ${leave.status} status`
      );
    }

    const isRejectedRecovery = extension.status === LEAVE_REQUEST_STATUS.REJECTED;

    const leaveType = await leaveTypeRepository.findById(leave.leaveTypeId);
    const leaveTypeQrMode = leaveType?.qrMode ?? null;
    await assertNoConflictingOverlap({
      studentId: leave.studentId,
      startAt: leave.startAt,
      endAt: extension.requestedEndAt,
      qrMode: leaveTypeQrMode,
      leaveTypeId: leave.leaveTypeId,
      excludeLeaveRequestId: leave.id,
      dbClient: tx,
    });

    // Fetch all approval steps for this extension ordered by stepOrder
    const allSteps = await leaveApprovalRepository.findByLeaveExtensionId(extensionId, tx);
    if (allSteps.length === 0) {
      throw new ConflictError("No approvals found for this extension");
    }

    const actionable = allSteps.filter(
      (s) =>
        s.decision === LEAVE_APPROVAL_DECISION.PENDING ||
        (isRejectedRecovery && s.decision === LEAVE_APPROVAL_DECISION.REJECTED)
    );

    if (actionable.length === 0) {
      throw new ConflictError("No approvals to override");
    }

    if (isRejectedRecovery) {
      await leaveExtensionRepository.updateById(
        extensionId,
        { status: LEAVE_REQUEST_STATUS.PENDING },
        tx
      );
    }

    const idsToProcess = mode === "ONE_STEP" ? [actionable[0]!.id] : actionable.map((s) => s.id);

    for (const approvalId of idsToProcess) {
      const step = actionable.find((s) => s.id === approvalId);
      if (step?.decision === LEAVE_APPROVAL_DECISION.REJECTED) {
        await leaveApprovalRepository.reopenApproval(approvalId, tx);
      }
      const isParentOverride = step?.stepKey === WORKFLOW_STEP_KEY.PARENT_APPROVAL;

      const updated = await leaveApprovalRepository.updateDecisionById(
        approvalId,
        LEAVE_APPROVAL_DECISION.APPROVED,
        userId,
        comments,
        new Date(),
        tx,
        LEAVE_APPROVAL_SOURCE.MANUAL
      );

      if (!updated) continue;

      await auditService.record(
        AUDIT_ACTION.OVERRIDE,
        AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
        approvalId,
        userId,
        {
          leaveExtensionId: extensionId,
          leaveRequestId: leave.id,
          mode,
          comments,
          isParentOverride,
          stepKey: step?.stepKey,
          stepOrder: step?.stepOrder,
        },
        tx
      );
    }

    // Check for remaining pending steps
    const remainingPending = await leaveApprovalRepository.findByEntityAndDecision(
      extensionId,
      leaveApprovals.leaveExtensionId,
      LEAVE_APPROVAL_DECISION.PENDING,
      tx
    );

    if (remainingPending.length > 0) {
      const nextStep = remainingPending[0]!;
      await leaveExtensionRepository.updateCurrentStep(
        extensionId,
        nextStep.stepKey,
        nextStep.stepOrder,
        tx
      );

      await outboxService.publish(
        {
          eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVAL_REQUIRED,
          aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
          aggregateId: extensionId,
          payload: {
            leaveId: leave.id,
            extensionId,
            stepKey: nextStep.stepKey,
            stepOrder: nextStep.stepOrder,
          },
        },
        tx
      );

      return {
        extensionId,
        leaveRequestId: leave.id,
        mode,
        approvalsOverridden: idsToProcess.length,
        newStatus: null,
        stepKey: nextStep.stepKey,
        stepOrder: nextStep.stepOrder,
      };
    }

    // All steps approved — finalize extension approval
    await leaveExtensionRepository.updateById(
      extensionId,
      {
        status: LEAVE_REQUEST_STATUS.APPROVED,
        approvedAt: new Date(),
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await leaveRepository.updateById(
      leave.id,
      {
        endAt: extension.requestedEndAt,
        status: LEAVE_REQUEST_STATUS.APPROVED,
      },
      tx
    );

    // If student was marked OVERDUE because leave ended before extension approval, restore to OUTSIDE_HOSTEL
    const student = await studentRepository.findById(leave.studentId, tx);
    if (student && student.currentLocationState === MOVEMENT_STATE.OVERDUE) {
      await studentRepository.updateCurrentLocationState(
        student.id,
        MOVEMENT_STATE.OUTSIDE_HOSTEL,
        tx
      );
    }

    await extendQrPassWindow(leave.id, extension.requestedEndAt, tx);

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      extensionId,
      userId,
      {
        oldStatus: extension.status,
        newStatus: LEAVE_REQUEST_STATUS.APPROVED,
        mode,
        comments,
      },
      tx
    );

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_APPROVED,
        aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
        aggregateId: extensionId,
        payload: {
          leaveId: leave.id,
          extensionId,
          studentId: leave.studentId,
          overridden: true,
          mode,
        },
      },
      tx
    );

    return {
      extensionId,
      leaveRequestId: leave.id,
      mode,
      approvalsOverridden: idsToProcess.length,
      newStatus: LEAVE_REQUEST_STATUS.APPROVED,
      stepKey: null,
      stepOrder: null,
    };
  });
}
