import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import {
  checkParentOverride,
  getApprovalAuditMeta,
  handleNextStep,
  updateApprovalAndAudit,
} from "@/services/leave/shared-approval.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ApproveExtensionResult = {
  extensionId: string;
  leaveRequestId: string;
  decision: string;
  stepKey: string | null;
  stepOrder: number | null;
  newStatus: string | null;
  warning?: string;
  requiresConfirmation?: boolean;
};

export async function approveExtension(
  extensionId: string,
  dto: ApproveLeaveDto,
  currentUser: { id: string; roles: string[] }
): Promise<ApproveExtensionResult> {
  const extension = await leaveExtensionRepository.findById(extensionId);

  if (!extension) throw new NotFoundError("LeaveExtension");

  if (extension.status !== LEAVE_REQUEST_STATUS.PENDING) {
    throw new ConflictError("Extension is not in a state that can be approved");
  }

  return await db.transaction(async (tx) => {
    const extensionInTx =
      await leaveExtensionRepository.findByIdForUpdate(extensionId, tx);

    if (!extensionInTx) throw new NotFoundError("LeaveExtension");

    if (extensionInTx.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError("Extension is not in a state that can be approved");
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

    const override = checkParentOverride(current, dto, currentUser);
    if (override?.requiresConfirmation) {
      const { isParentOverride: _, ...overrideFields } = override;
      return { extensionId, leaveRequestId: extensionInTx.leaveRequestId, ...overrideFields } as ApproveExtensionResult;
    }

    await updateApprovalAndAudit(
      current,
      LEAVE_APPROVAL_DECISION.APPROVED,
      currentUser.id,
      dto.comments,
      AUDIT_ACTION.APPROVE,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      getApprovalAuditMeta(extensionId, dto.comments, override!.isParentOverride),
      tx
    );

    const nextResult = await handleNextStep(
      extensionId,
      leaveApprovals.leaveExtensionId,
      current.stepOrder,
      (id, stepKey, stepOrder, t) => leaveExtensionRepository.updateCurrentStep(id, stepKey, stepOrder, t),
      (next) => ({
        extensionId,
        leaveRequestId: extensionInTx.leaveRequestId,
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        stepKey: next.stepKey,
        stepOrder: next.stepOrder,
        newStatus: null,
      }),
      tx
    );

    if (nextResult) return nextResult;

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
      extensionInTx.leaveRequestId,
      {
        endAt: extensionInTx.requestedEndAt,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      extensionInTx.leaveRequestId,
      currentUser.id,
      {
        extensionId,
        oldEndAt: extensionInTx.currentEndAt.toISOString(),
        newEndAt: extensionInTx.requestedEndAt.toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_APPROVED,
      aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
      aggregateId: extensionId,
      payload: {
        leaveId: extensionInTx.leaveRequestId,
        extensionId,
        studentId: extensionInTx.leaveRequestId,
      },
    }, tx);

    return {
      extensionId,
      leaveRequestId: extensionInTx.leaveRequestId,
      decision: LEAVE_APPROVAL_DECISION.APPROVED,
      stepKey: null,
      stepOrder: null,
      newStatus: LEAVE_REQUEST_STATUS.APPROVED,
    };
  });
}
