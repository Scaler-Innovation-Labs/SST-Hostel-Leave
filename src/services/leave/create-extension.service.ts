import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import type { CreateExtensionDto } from "@/dto/leave/create-extension.dto";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { policyEngine } from "@/services/policy/policy-engine";
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
  currentUser: { id: string }
): Promise<CreateExtensionResult> {
  const leave = await leaveRepository.findById(leaveRequestId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  if (leave.status !== LEAVE_REQUEST_STATUS.APPROVED) {
    throw new ConflictError(
      "Can only extend APPROVED leave requests"
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

  return await db.transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveRequestId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (leaveInTx.status !== LEAVE_REQUEST_STATUS.APPROVED) {
      throw new ConflictError(
        "Can only extend APPROVED leave requests"
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
        leaveType.defaultWorkflowId,
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

    const approvalsToCreate = approvalSteps.map((step) => ({
      leaveExtensionId: createdExtension.id,
      stepKey: step.stepKey,
      stepOrder: step.stepOrder,
      approverRoleId: step.approverRoleId ?? null,
      decision: LEAVE_APPROVAL_DECISION.PENDING,
      approvalSource: LEAVE_APPROVAL_SOURCE.WEB,
    }));

    await leaveApprovalRepository.createMany(approvalsToCreate, tx);

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

    return {
      extensionId: createdExtension.id,
      leaveRequestId,
      extensionNumber,
      requestedEndAt: requestedEnd,
      status: LEAVE_REQUEST_STATUS.PENDING,
    };
  });
}

