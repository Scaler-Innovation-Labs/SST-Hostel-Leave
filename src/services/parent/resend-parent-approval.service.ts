import { eq } from "drizzle-orm";

import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { leaveApprovalParentDetails, leaveApprovals } from "@/db/schema/leave";
import type { CurrentUser } from "@/lib/auth/types";
import { getPublicBaseUrl } from "@/lib/base-url";
import { transaction } from "@/lib/db/transaction";
import { AuthorizationError, ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export async function resendParentApproval(
  leaveId: string,
  currentUserOrId: CurrentUser | string
): Promise<{ success: boolean; message: string }> {
  const actorUserId =
    typeof currentUserOrId === "string" ? currentUserOrId : currentUserOrId.id;

  return await transaction(async (tx) => {
    const leave = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leave) {
      throw new NotFoundError("LeaveRequest");
    }

    // IDOR / ABAC guard: a student may only resend parent approval for their
    // own leave; staff must be within the leave's hostel scope.
    if (typeof currentUserOrId === "object" && currentUserOrId !== null) {
      await assertCanAccessLeave(currentUserOrId, leave);
    } else {
      const student = await studentRepository.findByUserId(currentUserOrId);
      if (student && student.id !== leave.studentId) {
        throw new AuthorizationError("Cannot resend parent approval for another student's leave");
      }
    }

    if (leave.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError(`Cannot resend parent approval for leave in ${leave.status} status`);
    }

    const pendingApprovals = await leaveApprovalRepository.findByEntityAndDecision(
      leaveId,
      leaveApprovals.leaveRequestId,
      LEAVE_APPROVAL_DECISION.PENDING,
      tx
    );

    const currentApproval = pendingApprovals.find(
      (a) => a.stepOrder === leave.currentStepOrder || a.stepKey === WORKFLOW_STEP_KEY.PARENT_APPROVAL
    );

    if (
      !currentApproval ||
      (currentApproval.stepKey !== WORKFLOW_STEP_KEY.PARENT_APPROVAL &&
        (currentApproval.metadata as Record<string, unknown> | null)?.isParentApproval !== true)
    ) {
      throw new ConflictError("Parent approval is not currently pending for this leave");
    }

    const parentApprovalWithDetails = await leaveParentApprovalRepository.findById(
      currentApproval.id,
      tx
    );

    const parentId = parentApprovalWithDetails?.parentDetails?.parentId;

    const student = await studentRepository.findById(leave.studentId, tx);
    const user = student?.userId ? await userRepository.findById(student.userId, tx) : null;
    const studentName = user?.fullName ?? "Student";
    const leaveDates = `${new Date(leave.startAt).toLocaleDateString()} - ${new Date(leave.endAt).toLocaleDateString()}`;

    // Reset token expiration so generateParentApproval mints a fresh token
    if (typeof (tx as any).update === "function") {
      await (tx as any)
        .update(leaveApprovalParentDetails)
        .set({
          tokenExpiresAt: new Date(0),
        })
        .where(eq(leaveApprovalParentDetails.approvalId, currentApproval.id));
    }

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
          approvalStepId: currentApproval.id,
          approvalStepKey: currentApproval.stepKey,
          parentId: parentId ?? undefined,
        },
        idempotencyKey: `PARENT_APPROVAL_REQUIRED:${currentApproval.id}:resend:${Date.now()}`,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      currentApproval.id,
      actorUserId,
      {
        action: "RESEND_PARENT_APPROVAL",
        leaveId: leave.id,
      },
      tx
    );

    return {
      success: true,
      message: "Parent approval link resent successfully",
    };
  });
}
