import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { NOTIFICATION_EVENT } from "@/constants/notification/notification-event";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import type { LeaveRequest } from "@/db/repositories/leave/leave.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import type { CreateLeaveDto } from "@/dto/leave/create-leave.dto";
import { db } from "@/lib/db";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@/lib/errors";
import { resolveApprovalSource } from "@/lib/workflows/resolve-approval-source";
import { auditService } from "@/services/audit/audit.service";
import { validateLeaveSubmittedForm } from "@/services/leave/validate-leave-form.service";
import { notificationService } from "@/services/notification/notification.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { policyEngine } from "@/services/policy/policy-engine";
import { workflowEngine } from "@/services/workflow/workflow-engine";

export async function createLeave(
  dto: CreateLeaveDto,
  currentUser: { id: string }
): Promise<LeaveRequest> {
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
        submittedForm,
      },
    );

  if (!policyResult.allowed) {
    const user = await userRepository.findById(currentUser.id);
    const studentName = user?.fullName ?? "Student";
    const studentRollNumber = student?.rollNumber ?? "";
    const formatDate = (date: Date) =>
      date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

    const policyTemplateCode = getPolicyRejectionTemplateCode(leaveType.code);
    if (policyTemplateCode) {
      await notificationService.notify(
        NOTIFICATION_EVENT.LEAVE_REJECTED,
        {
          leaveTypeId: leaveType.id,
          studentId: student.id,
          recipientEmail: user?.email ?? undefined,
          recipientPhone: user?.phone ?? undefined,
          userId: user?.id,
          templateCode: policyTemplateCode,
          variables: {
            studentName,
            rollNumber: studentRollNumber,
            startDate: formatDate(new Date(dto.startAt)),
            endDate: formatDate(new Date(dto.endAt)),
            reason: policyResult.restrictions.join(", "),
            leaveTypeName: leaveType.name,
            leaveCategory: leaveType.category,
          },
        },
      );
    }

    throw new ConflictError("Policy restricted: " + policyResult.restrictions.join(", "));
  }

  const requestNumber = `LR-${Date.now()}`;

  const created = await db.transaction(async (tx) => {
    await studentRepository.findByIdForUpdate(student.id, tx);

    const overlapping = await leaveRepository.findOverlappingLeaves(
      student.id,
      dto.leaveTypeId,
      new Date(dto.startAt),
      new Date(dto.endAt),
      tx
    );

    if (overlapping.length > 0) {
      throw new ConflictError("Overlapping leave exists");
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

    const parentApprovalStep = approvalSteps.find((s) => s.isParentApproval);
    let parentId: string | null = null;
    if (parentApprovalStep) {
      const parent = await parentRepository.findPrimaryByStudentId(student.id, tx);
      parentId = parent?.id ?? null;
    }

    const approvalsToCreate = approvalSteps.map((step) => {
      let approverUserId: string | null = null;
      if (step.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL && dto.pocId) {
        approverUserId = dto.pocId;
      }

      return {
        leaveRequestId: createdLeave.id,
        stepKey: step.stepKey,
        stepOrder: step.stepOrder,
        approverRoleId: step.approverRoleId ?? null,
        approverUserId,
        approverParentId: step.isParentApproval ? parentId : null,
        decision: LEAVE_APPROVAL_DECISION.PENDING,
        approvalSource: resolveApprovalSource(step.approvalMethod ?? null, step.isParentApproval),
      };
    });

    const createdApprovals = await leaveApprovalRepository.createMany(approvalsToCreate, tx);

    const stepKeyToApprovalId = new Map<string, string>();
    for (let i = 0; i < createdApprovals.length; i++) {
      stepKeyToApprovalId.set(approvalSteps[i]!.stepKey, createdApprovals[i]!.id);
    }

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

          const approvalId = stepKeyToApprovalId.get(step.stepKey);
          if (approvalId) {
            await leaveApprovalRepository.autoApprove(approvalId, tx);
          }

          await outboxService.publish({
            eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
            aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
            aggregateId: createdLeave.id,
            payload: {
              leaveId: createdLeave.id,
              studentId: student.id,
              decision: LEAVE_APPROVAL_DECISION.APPROVED,
            },
          }, tx);
        }
        continue;
      }

      if (step.isParentApproval && (!method || method === "SMS_REPLY" || method === "SMS_AND_LINK")) {
        const approvalId = stepKeyToApprovalId.get(step.stepKey);
        if (!approvalId) continue;

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
            approvalStepId: approvalId,
            approvalStepKey: step.stepKey,
          },
        }, tx);
      }

      if (method === "SMS_LINK") {
        await outboxService.publish({
          eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
          aggregateType: AGGREGATE_TYPE.NOTIFICATION,
          aggregateId: createdLeave.id,
          payload: {
            notificationType: "LEAVE_SUBMITTED",
            leaveRequestId: createdLeave.id,
            variables: { studentName, dates: leaveDates, reason: dto.reason },
          },
        }, tx);
      }
    }

    return createdLeave;
  });

  return created;
}

const POLICY_REJECTION_TEMPLATES: Record<string, string> = {
  RE_EXAM: "leave_rejected_email_re_exam_policy",
  LONG_LEAVE: "leave_rejected_email_long_leave_admin",
  LATE_ENTRY: "leave_rejected_email_late_entry_admin",
  LATE_STAY_COLLEGE: "leave_rejected_email_late_stay_admin",
  DIFFERENT_HOSTEL: "leave_rejected_email_diff_hostel_admin",
  HOLIDAY: "leave_rejected_email_holiday_admin",
  INTERNSHIP: "leave_rejected_email_internship_admin",
  MARRIAGE_BEREAVEMENT: "leave_rejected_email_marriage_policy",
};

function getPolicyRejectionTemplateCode(leaveTypeCode: string): string | null {
  return POLICY_REJECTION_TEMPLATES[leaveTypeCode] ?? null;
}
