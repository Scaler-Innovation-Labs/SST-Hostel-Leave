import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REJECTION_SOURCE } from "@/constants/leave/leave-rejection-source";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_MODE } from "@/constants/leave/qr-mode";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { getQrExpiryFromLeaveEnd } from "@/constants/movement/qr-window";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveRejectionRepository } from "@/db/repositories/leave/leave-rejection.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { CreateExtensionDto } from "@/dto/leave/create-extension.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getPublicBaseUrl } from "@/lib/base-url";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { resolveApprovalSource } from "@/lib/workflows/resolve-approval-source";
import { auditService } from "@/services/audit/audit.service";
import { assertNoConflictingOverlap } from "@/services/leave/overlap-guard.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { policyEngine } from "@/services/policy/policy-engine";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";
import { workflowEngine } from "@/services/workflow/workflow-engine";

export type CreateExtensionResult = {
  extensionId: string;
  leaveRequestId: string;
  extensionNumber: number;
  requestedEndAt: Date;
  status: string;
};

export async function createExtension(
  leaveRequestId: string,
  dto: CreateExtensionDto,
  currentUser: CurrentUser
): Promise<CreateExtensionResult> {
  const leave = await leaveRepository.findById(leaveRequestId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  // IDOR guard: a STUDENT may only extend their own leave; staff must be
  // within the leave's hostel scope.
  await assertCanAccessLeave(currentUser, leave);

  if (
    leave.status !== LEAVE_REQUEST_STATUS.APPROVED &&
    leave.status !== LEAVE_REQUEST_STATUS.OVERDUE
  ) {
    throw new ConflictError(
      "Can only extend APPROVED or OVERDUE leave requests"
    );
  }

  const leaveType = await leaveTypeRepository.findById(leave.leaveTypeId);

  if (!leaveType || !leaveType.allowExtensions) {
    throw new ValidationError(
      "This leave type does not allow extensions"
    );
  }

  if (!leaveType.defaultWorkflowId) {
    throw new ValidationError("Leave type has no default workflow configured");
  }

  const existingExtensions = await leaveExtensionRepository.findByLeaveRequestId(leaveRequestId);
  const extensionCount = existingExtensions.length;

  const policyResult = await policyEngine.evaluate({
    leaveType: {
      id: leaveType.id,
      code: leaveType.code,
      defaultWorkflowId: leaveType.defaultWorkflowId,
      maxExtensionCount: leaveType.maxExtensionCount,
      allowExtensions: leaveType.allowExtensions,
    },
    extensionCount,
  });

  if (!policyResult.allowed) {
    await leaveRejectionRepository.create({
      studentId: leave.studentId,
      leaveTypeId: leave.leaveTypeId,
      leaveRequestId,
      rejectionSource: LEAVE_REJECTION_SOURCE.POLICY,
      reason: policyResult.restrictions.join("; "),
      restrictions: policyResult.restrictions,
      startAt: leave.startAt,
      endAt: new Date(dto.requestedEndAt),
    });
    throw new ValidationError(
      `Policy restriction: ${policyResult.restrictions.join("; ")}`
    );
  }

  const requestedEnd = new Date(dto.requestedEndAt);
  if (requestedEnd <= leave.endAt) {
    throw new ValidationError(
      "Extension end date must be after current leave end date"
    );
  }

  // Store validated workflow ID for use inside transaction
  const defaultWorkflowId: string = leaveType.defaultWorkflowId;

  return await db.transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveRequestId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (
      leaveInTx.status !== LEAVE_REQUEST_STATUS.APPROVED &&
      leaveInTx.status !== LEAVE_REQUEST_STATUS.OVERDUE
    ) {
      throw new ConflictError(
        "Can only extend APPROVED or OVERDUE leave requests"
      );
    }

    if (!leaveType.allowExtensions) {
      throw new ValidationError(
        "This leave type does not allow extensions"
      );
    }

    const extensionNumber =
      await leaveExtensionRepository.getNextExtensionNumber(
        leaveRequestId,
        tx
      );

    const createdExtension =
      await leaveExtensionRepository.create(
        {
          leaveRequestId,
          extensionNumber,
          currentEndAt: leaveInTx.endAt,
          requestedEndAt: requestedEnd,
          reason: dto.reason,
          status: LEAVE_REQUEST_STATUS.PENDING,
          submittedForm: dto.submittedForm ?? null,
          submittedAt: new Date(),
        },
        tx
      );

    const { steps: approvalSteps } =
      await workflowEngine.resolve(
        defaultWorkflowId,
        tx
      );

    const firstStep = workflowEngine.getFirstStep(approvalSteps);

    if (firstStep) {
      await leaveExtensionRepository.updateCurrentStep(
        createdExtension.id,
        firstStep.stepKey,
        firstStep.stepOrder,
        tx
      );
    }

    // Resolve parent approval step
    const parentApprovalStep = approvalSteps.find((s) => s.isParentApproval);
    let parentId: string | null = null;
    if (parentApprovalStep) {
      const parent = await parentRepository.findPrimaryByStudentId(leave.studentId, tx);
      parentId = parent?.id ?? null;
    }

    const approvalsToCreate = approvalSteps.map((step) => ({
      leaveExtensionId: createdExtension.id,
      stepKey: step.stepKey,
      stepOrder: step.stepOrder,
      approverRoleId: step.approverRoleId ?? null,
      approverParentId: step.isParentApproval ? parentId : null,
      decision: LEAVE_APPROVAL_DECISION.PENDING,
      approvalSource: resolveApprovalSource(step.approvalMethod ?? null, step.isParentApproval),
    }));

    const createdApprovals = await leaveApprovalRepository.createMany(approvalsToCreate, tx);

    const stepKeyToApprovalId = new Map<string, string>();
    for (let i = 0; i < createdApprovals.length; i++) {
      stepKeyToApprovalId.set(approvalSteps[i]!.stepKey, createdApprovals[i]!.id);
    }

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      createdExtension.id,
      currentUser.id,
      {
        leaveRequestId,
        extensionNumber,
        requestedEndAt: requestedEnd.toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENDED,
      aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
      aggregateId: createdExtension.id,
      payload: {
        leaveId: leaveRequestId,
        extensionId: createdExtension.id,
        extensionNumber,
        studentId: leave.studentId,
      },
    }, tx);

    // Resolve user info for outbox events
    const user = await userRepository.findById(currentUser.id, tx);
    const studentName = user?.fullName ?? "Student";
    const leaveDates = `${leaveInTx.startAt.toLocaleDateString()} - ${leaveInTx.endAt.toLocaleDateString()}`;

    // Post-creation actions: auto-approvals, SMS dispatches, parent approvals
    for (const step of approvalSteps) {
      const method = step.approvalMethod ?? null;

      if (method === "AUTO") {
        const nextStep = workflowEngine.getNextStep(approvalSteps, step.stepOrder);

        if (nextStep) {
          await leaveExtensionRepository.updateCurrentStep(
            createdExtension.id,
            nextStep.stepKey,
            nextStep.stepOrder,
            tx
          );
        } else {
          await leaveExtensionRepository.updateById(
            createdExtension.id,
            {
              status: LEAVE_REQUEST_STATUS.APPROVED,
              approvedAt: new Date(),
              currentStepKey: null,
              currentStepOrder: null,
            },
            tx
          );

          await assertNoConflictingOverlap({
            studentId: leave.studentId,
            startAt: leaveInTx.startAt,
            endAt: requestedEnd,
            qrMode: leaveType.qrMode,
            leaveTypeId: leave.leaveTypeId,
            excludeLeaveRequestId: leaveRequestId,
            dbClient: tx,
          });

          await leaveRepository.updateById(
            leaveRequestId,
            {
              endAt: requestedEnd,
              // An extended OVERDUE leave is authorized again through the new
              // end date; no-op for already-APPROVED leaves.
              status: LEAVE_REQUEST_STATUS.APPROVED,
            },
            tx
          );

          // Contract T14: an extended QR leave's pass window grows with the
          // new end date so the exit/return credential stays usable through
          // the extension period.
          if (leaveType.qrMode && leaveType.qrMode !== QR_MODE.NONE) {
            const pass = await qrPassRepository.findByLeaveRequestId(
              leaveRequestId,
              tx
            );
            if (pass && pass.status === QR_STATUS.ACTIVE) {
              await qrPassRepository.updateExpiresAt(
                pass.id,
                getQrExpiryFromLeaveEnd(requestedEnd),
                tx
              );
            }
          }

          await outboxService.publish({
            eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_APPROVED,
            aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
            aggregateId: createdExtension.id,
            payload: {
              leaveId: leaveRequestId,
              extensionId: createdExtension.id,
              studentId: leave.studentId,
            },
          }, tx);
        }
        continue;
      }

      if (step.isParentApproval) {
        const approvalId = stepKeyToApprovalId.get(step.stepKey);
        if (!approvalId) continue;

        const baseUrl = getPublicBaseUrl();
        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED,
          aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
          aggregateId: createdExtension.id,
          payload: {
            leaveRequestId,
            leaveExtensionId: createdExtension.id,
            studentId: leave.studentId,
            studentName,
            leaveDates,
            leaveReason: dto.reason,
            baseUrl,
            approvalStepId: approvalId,
            approvalStepKey: step.stepKey,
          },
        }, tx);
      }

      if (method === "SMS_LINK") {
        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
          aggregateType: AGGREGATE_TYPE.NOTIFICATION,
          aggregateId: createdExtension.id,
          payload: {
            notificationType: "LEAVE_EXTENSION_REQUESTED",
            leaveRequestId,
            leaveExtensionId: createdExtension.id,
            variables: { studentName, dates: leaveDates, reason: dto.reason },
          },
        }, tx);
      }
    }

    return {
      extensionId: createdExtension.id,
      leaveRequestId,
      extensionNumber,
      requestedEndAt: requestedEnd,
      status: LEAVE_REQUEST_STATUS.PENDING,
    };
  });
}
