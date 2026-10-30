import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { leaveRepository,type LeaveRequest } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { leaveApprovals } from "@/db/schema/leave";
import { getPublicBaseUrl } from "@/lib/base-url";
import type { DbClient } from "@/lib/db/transaction";
import { getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { issueQrPassForApprovedLeave } from "@/services/leave/qr-pass-lifecycle.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type WorkflowStepLike = {
  id: string;
  stepKey: string;
  stepOrder: number;
  approvalSource?: string | null;
  metadata?: unknown;
};

export type ActivateWorkflowStepInput = {
  leave: LeaveRequest;
  step: WorkflowStepLike;
  studentName?: string;
  leaveDates?: string;
  parentId?: string | null;
  dbClient: DbClient;
};

/**
 * Centrally activates a workflow step when it becomes current.
 *
 * Rules:
 * 1. AUTO steps: immediately auto-approved, then recursively activates the next step.
 *    If there are no further steps, transitions the leave to APPROVED and issues the QR pass.
 * 2. PARENT_APPROVAL steps: emits PARENT_APPROVAL_REQUIRED outbox event only now,
 *    ensuring the parent approval token is minted and its 48-hour expiration window starts
 *    only when the parent is expected to act.
 * 3. Standard steps (POC, ADMIN, WARDEN): emits LEAVE_APPROVAL_REQUIRED so approvers
 *    are notified that an item is waiting in their queue.
 */
export async function activateWorkflowStep(input: ActivateWorkflowStepInput): Promise<void> {
  const { leave, step, dbClient } = input;
  const meta = step.metadata as Record<string, unknown> | null | undefined;
  const isAuto =
    step.approvalSource === "SYSTEM" ||
    meta?.approvalMethod === "AUTO";

  if (isAuto) {
    await leaveApprovalRepository.autoApprove(step.id, dbClient);

    const nextApproval = await leaveApprovalRepository.findNextByEntityAndDecision(
      leave.id,
      leaveApprovals.leaveRequestId,
      step.stepOrder,
      LEAVE_APPROVAL_DECISION.PENDING,
      dbClient
    );

    if (nextApproval) {
      await leaveRepository.updateCurrentStep(
        leave.id,
        nextApproval.stepKey,
        nextApproval.stepOrder,
        dbClient
      );

      // Recursively activate the next step (e.g. AUTO -> ADMIN, or AUTO -> AUTO)
      await activateWorkflowStep({
        leave,
        step: nextApproval,
        studentName: input.studentName,
        leaveDates: input.leaveDates,
        parentId: input.parentId,
        dbClient,
      });
      return;
    }

    // Final step completed via AUTO — approve the leave
    const nextState = getNextState(leave.status, LEAVE_ACTION.APPROVE);

    await leaveRepository.updateById(
      leave.id,
      {
        status: nextState,
        approvedAt: new Date(),
        currentStepKey: null,
        currentStepOrder: null,
      },
      dbClient
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leave.id,
      "SYSTEM",
      {
        oldStatus: leave.status,
        newStatus: nextState,
      },
      dbClient
    );

    await issueQrPassForApprovedLeave(leave, dbClient);

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leave.id,
        payload: {
          leaveId: leave.id,
          studentId: leave.studentId,
          decision: LEAVE_APPROVAL_DECISION.APPROVED,
        },
      },
      dbClient
    );
    return;
  }

  const isParentApproval =
    step.stepKey === WORKFLOW_STEP_KEY.PARENT_APPROVAL ||
    meta?.isParentApproval === true;

  if (isParentApproval) {
    let parentId = input.parentId;
    if (!parentId) {
      const parent = await parentRepository.findPrimaryByStudentId(leave.studentId, dbClient);
      parentId = parent?.id ?? null;
    }

    let studentName = input.studentName;
    if (!studentName) {
      const student = await studentRepository.findById(leave.studentId, dbClient);
      if (student?.userId) {
        const user = await userRepository.findById(student.userId, dbClient);
        studentName = user?.fullName ?? "Student";
      } else {
        studentName = "Student";
      }
    }

    const leaveDates =
      input.leaveDates ??
      `${new Date(leave.startAt).toLocaleDateString()} - ${new Date(leave.endAt).toLocaleDateString()}`;

    const baseUrl = getPublicBaseUrl();

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: leave.id,
        payload: {
          leaveRequestId: leave.id,
          studentId: leave.studentId,
          studentName,
          leaveDates,
          leaveReason: leave.reason,
          baseUrl,
          approvalStepId: step.id,
          approvalStepKey: step.stepKey,
          parentId: parentId ?? undefined,
        },
        idempotencyKey: `PARENT_APPROVAL_REQUIRED:${step.id}`,
      },
      dbClient
    );
    return;
  }

  // Standard staff step (POC, ADMIN, WARDEN)
  await outboxService.publish(
    {
      eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVAL_REQUIRED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leave.id,
      payload: {
        leaveId: leave.id,
        studentId: leave.studentId,
        stepKey: step.stepKey,
        stepOrder: step.stepOrder,
      },
    },
    dbClient
  );

  if (meta?.approvalMethod === "SMS_LINK") {
    let studentName = input.studentName;
    if (!studentName) {
      const student = await studentRepository.findById(leave.studentId, dbClient);
      if (student?.userId) {
        const user = await userRepository.findById(student.userId, dbClient);
        studentName = user?.fullName ?? "Student";
      } else {
        studentName = "Student";
      }
    }

    const leaveDates =
      input.leaveDates ??
      `${new Date(leave.startAt).toLocaleDateString()} - ${new Date(leave.endAt).toLocaleDateString()}`;

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
        aggregateType: AGGREGATE_TYPE.NOTIFICATION,
        aggregateId: leave.id,
        payload: {
          notificationType: "LEAVE_SUBMITTED",
          leaveRequestId: leave.id,
          variables: {
            studentName,
            dates: leaveDates,
            reason: leave.reason,
          },
        },
      },
      dbClient
    );
  }
}
