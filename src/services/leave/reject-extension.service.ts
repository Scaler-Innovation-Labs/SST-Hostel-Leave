import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { requireApprovalAuthorization } from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { updateApprovalAndAudit } from "@/services/leave/shared-approval.service";

export type RejectExtensionResult = {
  extensionId: string;
  leaveRequestId: string;
  decision: string;
  stepKey: null;
  stepOrder: null;
  newStatus: string;
};

export async function rejectExtension(
  extensionId: string,
  dto: ApproveLeaveDto,
  currentUser: { id: string; roles: string[] }
): Promise<RejectExtensionResult> {
  const extension = await leaveExtensionRepository.findById(extensionId);

  if (!extension) throw new NotFoundError("LeaveExtension");

  if (extension.status !== LEAVE_REQUEST_STATUS.PENDING) {
    throw new ConflictError("Extension is not in a state that can be rejected");
  }

  return await db.transaction(async (tx) => {
    const extensionInTx =
      await leaveExtensionRepository.findByIdForUpdate(extensionId, tx);

    if (!extensionInTx) throw new NotFoundError("LeaveExtension");

    if (extensionInTx.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError("Extension is not in a state that can be rejected");
    }

    const pending =
      await leaveApprovalRepository.findByEntityAndDecision(
        extensionId,
        leaveApprovals.leaveExtensionId,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (pending.length === 0) {
      throw new ConflictError("No pending approval");
    }

    const current = pending[0]!;

    requireApprovalAuthorization(current, currentUser);

    await updateApprovalAndAudit(
      current,
      LEAVE_APPROVAL_DECISION.REJECTED,
      currentUser.id,
      dto.comments,
      AUDIT_ACTION.REJECT,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      {
        leaveExtensionId: extensionId,
        comments: dto.comments,
      },
      tx
    );

    await leaveExtensionRepository.updateById(
      extensionId,
      {
        status: LEAVE_REQUEST_STATUS.REJECTED,
        rejectedAt: new Date(),
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      extensionId,
      currentUser.id,
      {
        oldStatus: LEAVE_REQUEST_STATUS.PENDING,
        newStatus: LEAVE_REQUEST_STATUS.REJECTED,
        rejectedAt: new Date().toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_REJECTED,
      aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
      aggregateId: extensionId,
      payload: {
        leaveId: extensionInTx.leaveRequestId,
        extensionId,
        reason: dto.comments ?? "",
      },
    }, tx);

    return {
      extensionId,
      leaveRequestId: extensionInTx.leaveRequestId,
      decision: LEAVE_APPROVAL_DECISION.REJECTED,
      stepKey: null,
      stepOrder: null,
      newStatus: LEAVE_REQUEST_STATUS.REJECTED,
    };
  });
}
