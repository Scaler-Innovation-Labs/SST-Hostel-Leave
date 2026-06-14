import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import type { LeaveApprovalSource } from "@/constants/leave/approval-source";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { userRepository } from "@/db/repositories/auth/user.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import { db } from "@/lib/db";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { validateLeaveSubmittedForm } from "@/services/leave/validate-leave-form.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { policyEngine } from "@/services/policy/policy-engine";
import { workflowEngine } from "@/services/workflow/workflow-engine";

function resolveApprovalSource(method: string | null, isParent: boolean): LeaveApprovalSource {
  if (isParent && !method) return "SMS";
  if (isParent && method === "PORTAL") return "PORTAL";
  if (method === "PORTAL" || !method) return "PORTAL";
  if (method === "SMS_REPLY") return "SMS_REPLY";
  if (method === "SMS_LINK" || method === "SMS_AND_LINK") return "EMAIL_LINK";
  if (method === "AUTO") return "SYSTEM";
  return "WEB";
}

export async function createLeave(
  dto: CreateLeaveDto,
  currentUser: { id: string }
) {
  const student = await studentRepository.findByUserId(currentUser.id);

  if (!student) {
    throw new AuthorizationError("Only students can create leave requests");
  }
  const studentPolicyContext = await studentRepository.findPolicyContextByUserId?.(currentUser.id) ?? null;

  const leaveType = await leaveTypeRepository.findById(
    dto.leaveTypeId
  );

  if (!leaveType) {
    throw new NotFoundError("LeaveType");
  }

  const defaultWorkflowId = leaveType.defaultWorkflowId;
  const submittedForm = validateLeaveSubmittedForm(leaveType.formSchema, dto.submittedForm);

  if (!defaultWorkflowId) {
    throw new ValidationError("Leave type has no configured workflow");
  }

  const requestNumber = `LR-${Date.now()}`;

  const created = await db.transaction(async (tx) => {
    await studentRepository.findByIdForUpdate(student.id, tx);

    const overlapping = await leaveRepository.findOverlappingLeaves(
      student.id,
      new Date(dto.startAt),
      new Date(dto.endAt),
      tx
    );

    if (overlapping.length > 0) {
      throw new ConflictError("Overlapping leave exists");
    }

    const leaveDurationDays = Math.ceil(
      (new Date(dto.endAt).getTime() - new Date(dto.startAt).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const policyResult =
      await policyEngine.evaluate(
        {
          leaveType,
          leaveDurationDays,
          studentBatchYear: studentPolicyContext?.studentBatchYear,
          hostelId: studentPolicyContext?.hostelId,
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          expectedReturnAt: dto.expectedReturnAt ? new Date(dto.expectedReturnAt) : new Date(dto.endAt),
          submittedForm,
        },
        tx
      );
    if (!policyResult.allowed) {
      throw new ConflictError("Policy restricted: " + policyResult.restrictions.join(", "));
    }

    const { steps: approvalSteps } =
      await workflowEngine.resolve(
        defaultWorkflowId,
        tx
      );

    if (
      policyResult.requirements?.some((requirement) => requirement.includes("Parent approval required")) &&
      !approvalSteps.some((step) => step.isParentApproval)
    ) {
      throw new ValidationError("Policy requires parent approval, but the configured workflow has no parent approval step");
    }

  const firstStep = workflowEngine.getFirstStep(approvalSteps);

    const createdLeave =
  await leaveRepository.create(
    {
      requestNumber,
      studentId: student.id,
      leaveTypeId: leaveType.id,

      reason: dto.reason,

      status:
        LEAVE_REQUEST_STATUS.PENDING,

      startAt: new Date(dto.startAt),

      endAt: new Date(dto.endAt),

      expectedReturnAt:
        dto.expectedReturnAt
          ? new Date(
              dto.expectedReturnAt
            )
          : undefined,

      submittedForm:
        submittedForm,

      policyResult,

      submittedAt: new Date(),

      currentStepKey:
        firstStep?.stepKey ?? null,

      currentStepOrder:
        firstStep?.stepOrder ?? null,
    },
    tx
  );

    const approvalsToCreate = approvalSteps.map((step) => ({
      leaveRequestId: createdLeave.id,
      stepKey: step.stepKey,
      stepOrder: step.stepOrder,
      approverRoleId: step.approverRoleId ?? null,
      decision: LEAVE_APPROVAL_DECISION.PENDING,
      approvalSource: resolveApprovalSource(step.approvalMethod ?? null, step.isParentApproval),
    }));

    await leaveApprovalRepository.createMany(approvalsToCreate, tx);

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      createdLeave.id,
      currentUser.id,
      { requestNumber },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_CREATED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: createdLeave.id,
      payload: { leaveId: createdLeave.id, studentId: student.id, leaveTypeId: leaveType.id, requestNumber },
    }, tx);

    // Resolve user info for outbox events
    const user = await userRepository.findById(currentUser.id, tx);
    const studentName = user?.fullName ?? "Student";
    const leaveDates = `${new Date(dto.startAt).toLocaleDateString()} - ${new Date(dto.endAt).toLocaleDateString()}`;

    // Post-leave actions: auto-approvals, SMS dispatches, parent approvals
    for (const step of approvalSteps) {
      const method = step.approvalMethod ?? null;

      if (method === "AUTO") {
        const nextStep = workflowEngine.getNextStep(approvalSteps, step.stepOrder);

        if (nextStep) {
          await leaveRepository.updateCurrentStep(createdLeave.id, nextStep.stepKey, nextStep.stepOrder, tx);
        } else {
          await leaveRepository.updateById(createdLeave.id, {
            status: LEAVE_REQUEST_STATUS.APPROVED,
            approvedAt: new Date(),
            currentStepKey: null,
            currentStepOrder: null,
          }, tx);
        }
        continue;
      }

      if (step.isParentApproval && !method) {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED,
          aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
          aggregateId: createdLeave.id,
          payload: {
            leaveRequestId: createdLeave.id,
            studentId: student.id,
            studentName,
            leaveDates,
            leaveReason: dto.reason,
            baseUrl,
            approvalStepId: step.id,
            approvalStepKey: step.stepKey,
          },
        }, tx);
      }

      if (method === "SMS_REPLY" || method === "SMS_LINK" || method === "SMS_AND_LINK") {
        const channels = method === "SMS_AND_LINK" ? ["SMS_REPLY", "SMS_LINK"] : [method];
        for (const channel of channels) {
          await outboxService.publish({
            eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
            aggregateType: AGGREGATE_TYPE.NOTIFICATION,
            aggregateId: createdLeave.id,
            payload: {
              notificationType: channel === "SMS_REPLY" ? "PARENT_APPROVAL_REQUESTED" : "LEAVE_SUBMITTED",
              leaveRequestId: createdLeave.id,
              variables: { studentName, dates: leaveDates, reason: dto.reason },
            },
          }, tx);
        }
      }
    }

    return createdLeave;
  });

  return created;
}
