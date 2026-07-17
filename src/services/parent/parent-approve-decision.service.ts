import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_SOURCE } from "@/constants/leave/approval-source";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveParentApprovalRepository } from "@/db/repositories/leave/leave-parent-approval.repository";
import type { ParentDecisionDto } from "@/dto/parent/parent-decision.dto";
import { sha256 } from "@/lib/crypto";
import { type DbClient, transaction } from "@/lib/db/transaction";
import {
  ConflictError,
  NotFoundError,
} from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { recordMovement } from "@/services/movement/record-movement.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ParentDecisionResult = {
  approvalId: string;
  decision: string;
};

export async function parentApproveDecision(
  rawToken: string,
  dto: ParentDecisionDto
): Promise<ParentDecisionResult> {
  const tokenHash = await sha256(rawToken);

  return await transaction(async (tx) => {
    const approval =
      await leaveParentApprovalRepository.findByParentApprovalToken(
        tokenHash,
        tx
      );

    if (!approval) {
      throw new NotFoundError("Approval");
    }

    if (!approval.parentApprovalVerifiedAt) {
      throw new ConflictError("OTP not verified");
    }

    if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) {
      throw new ConflictError("Approval already processed");
    }

    const isExtension = !!approval.leaveExtensionId;

    const updatedApproval =
      await leaveParentApprovalRepository.updateParentDecision(
        approval.id,
        approval.approverParentId ?? "",
        dto.decision as LeaveApprovalDecision,
        dto.comments,
        tx
      );

    if (!updatedApproval) {
      throw new ConflictError("Approval already processed");
    }

    await auditService.record(
      dto.decision === LEAVE_APPROVAL_DECISION.APPROVED
        ? AUDIT_ACTION.APPROVE
        : AUDIT_ACTION.REJECT,
      AUDIT_ENTITY_TYPE.LEAVE_APPROVAL,
      approval.id,
      null,
      {
        leaveRequestId: approval.leaveRequestId,
        leaveExtensionId: approval.leaveExtensionId,
        comments: dto.comments,
        approvalSource: LEAVE_APPROVAL_SOURCE.SMS,
      },
      tx
    );

    if (isExtension) {
      return await handleExtensionDecision(approval, dto, tx);
    }

    return await handleLeaveDecision(approval, dto, tx);
  });
}

async function handleLeaveDecision(
  approval: NonNullable<Awaited<ReturnType<typeof leaveParentApprovalRepository.findByParentApprovalToken>>>,
  dto: ParentDecisionDto,
  tx: DbClient
): Promise<ParentDecisionResult> {
  if (dto.decision === LEAVE_APPROVAL_DECISION.REJECTED) {
    await leaveRepository.updateById(
      approval.leaveRequestId!,
      {
        status: LEAVE_REQUEST_STATUS.REJECTED,
        rejectedAt: new Date(),
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_REJECTED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: approval.leaveRequestId!,
      payload: {
        leaveRequestId: approval.leaveRequestId,
      },
    }, tx);
  } else {
    const next =
      await leaveApprovalRepository.findNextByEntityAndDecision(
        approval.leaveRequestId!,
        leaveApprovals.leaveRequestId,
        approval.stepOrder,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (next) {
      await leaveRepository.updateCurrentStep(
        approval.leaveRequestId!,
        next.stepKey,
        next.stepOrder,
        tx
      );
    } else {
      await leaveRepository.updateById(
        approval.leaveRequestId!,
        {
          status: LEAVE_REQUEST_STATUS.APPROVED,
          approvedAt: new Date(),
          currentStepKey: null,
          currentStepOrder: null,
        },
        tx
      );

      await auditService.record(
        AUDIT_ACTION.UPDATE,
        AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
        approval.leaveRequestId!,
        null,
        {
          oldStatus: LEAVE_REQUEST_STATUS.PENDING,
          newStatus: LEAVE_REQUEST_STATUS.APPROVED,
        },
        tx
      );

      const approvedLeave = await leaveRepository.findById(
        approval.leaveRequestId!,
        tx
      );

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_APPROVED,
        aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
        aggregateId: approval.leaveRequestId!,
        payload: {
          leaveRequestId: approval.leaveRequestId,
          studentId: approvedLeave?.studentId,
        },
      }, tx);

      if (approvedLeave?.studentId) {
        await recordMovement({
          studentId: approvedLeave.studentId,
          leaveRequestId: approval.leaveRequestId!,
          fromState: MOVEMENT_STATE.IN_HOSTEL,
          toState: MOVEMENT_STATE.APPROVED_LEAVE,
          eventType: MOVEMENT_EVENT.LEAVE_APPROVED,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
          dbClient: tx,
        });
      }
    }
  }

  return {
    approvalId: approval.id,
    decision: dto.decision,
  };
}

async function handleExtensionDecision(
  approval: NonNullable<Awaited<ReturnType<typeof leaveParentApprovalRepository.findByParentApprovalToken>>>,
  dto: ParentDecisionDto,
  tx: DbClient
): Promise<ParentDecisionResult> {
  const extensionId = approval.leaveExtensionId!;
  const leaveRequestId = approval.leaveExtension?.leaveRequestId ?? approval.leaveRequestId ?? "";

  if (dto.decision === LEAVE_APPROVAL_DECISION.REJECTED) {
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

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_REJECTED,
      aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
      aggregateId: extensionId,
      payload: {
        leaveId: leaveRequestId,
        extensionId,
        reason: dto.comments ?? "",
      },
    }, tx);
  } else {
    const next =
      await leaveApprovalRepository.findNextByEntityAndDecision(
        extensionId,
        leaveApprovals.leaveExtensionId,
        approval.stepOrder,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    if (next) {
      await leaveExtensionRepository.updateCurrentStep(
        extensionId,
        next.stepKey,
        next.stepOrder,
        tx
      );
    } else {
      const extension = await leaveExtensionRepository.findByIdWithLeave(extensionId, tx);

      if (!extension) throw new NotFoundError("LeaveExtension");

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
        leaveRequestId,
        {
          endAt: extension.requestedEndAt,
        },
        tx
      );

      await auditService.record(
        AUDIT_ACTION.UPDATE,
        AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
        leaveRequestId,
        null,
        {
          extensionId,
          oldEndAt: extension.currentEndAt.toISOString(),
          newEndAt: extension.requestedEndAt.toISOString(),
        },
        tx
      );

      await outboxService.publish({
        eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_APPROVED,
        aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
        aggregateId: extensionId,
        payload: {
          leaveId: leaveRequestId,
          extensionId,
          studentId: extension.leaveRequest?.studentId,
        },
      }, tx);
    }
  }

  return {
    approvalId: approval.id,
    decision: dto.decision,
  };
}
