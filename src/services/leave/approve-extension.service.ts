import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_MODE } from "@/constants/leave/qr-mode";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { getQrExpiryFromLeaveEnd } from "@/constants/movement/qr-window";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { ApproveLeaveDto } from "@/dto/leave/approve-leave.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { assertNoConflictingOverlap } from "@/services/leave/overlap-guard.service";
import {
  checkParentOverride,
  getApprovalAuditMeta,
  handleNextStep,
  updateApprovalAndAudit,
} from "@/services/leave/shared-approval.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

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
  currentUser: CurrentUser
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

    const leave = await leaveRepository.findById(extensionInTx.leaveRequestId);
    if (!leave) throw new NotFoundError("LeaveRequest");
    await assertCanAccessLeave(currentUser, leave);

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

    if (nextResult) {
      // A later workflow step is now current (e.g. admin review after POC
      // approval). Notify the next approver via the approval queue rules.
      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVAL_REQUIRED,
        aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
        aggregateId: extensionId,
        payload: {
          leaveId: extensionInTx.leaveRequestId,
          extensionId,
          stepKey: nextResult.stepKey,
          stepOrder: nextResult.stepOrder,
        },
      }, tx);
      return nextResult;
    }

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

    let leaveTypeQrMode: string | null | undefined;
    if (leave) {
      const leaveType = await leaveTypeRepository.findById(leave.leaveTypeId);
      leaveTypeQrMode = leaveType?.qrMode ?? null;
      await assertNoConflictingOverlap({
        studentId: leave.studentId,
        startAt: leave.startAt,
        endAt: extensionInTx.requestedEndAt,
        qrMode: leaveTypeQrMode,
        leaveTypeId: leave.leaveTypeId,
        excludeLeaveRequestId: leave.id,
        dbClient: tx,
      });
    }

    await leaveRepository.updateById(
      extensionInTx.leaveRequestId,
      {
        endAt: extensionInTx.requestedEndAt,
        // An extended OVERDUE leave is authorized again through the new end
        // date; no-op for already-APPROVED leaves.
        status: LEAVE_REQUEST_STATUS.APPROVED,
      },
      tx
    );

    // Contract T14: an extended QR leave's pass window grows with the new end
    // date so the exit/return credential stays usable through the extension
    // period.
    if (
      leave &&
      leaveTypeQrMode &&
      leaveTypeQrMode !== QR_MODE.NONE
    ) {
      const pass = await qrPassRepository.findByLeaveRequestId(
        extensionInTx.leaveRequestId,
        tx
      );
      if (pass && pass.status === QR_STATUS.ACTIVE) {
        await qrPassRepository.updateExpiresAt(
          pass.id,
          getQrExpiryFromLeaveEnd(extensionInTx.requestedEndAt),
          tx
        );
      }
    }

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
        studentId: leave.studentId,
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
