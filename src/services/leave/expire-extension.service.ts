import type { ActingRef } from "@/constants/audit/actor";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveApprovals } from "@/db";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ExpireExtensionSingleResult = {
  extensionId: string;
  leaveRequestId: string;
  newStatus: string;
  expiredAt: Date;
};

export type ExpireExtensionsBatchResult = {
  total: number;
  expired: number;
  skipped: number;
  errors: string[];
};

const BATCH_SIZE = 50;

/**
 * Expires/rejects a single pending extension whose parent approval link has expired
 * or whose requested end date has already passed.
 */
export async function expireSingleExtension(
  extensionId: string,
  currentUser: ActingRef,
  reason: string = "Parent approval link expired without response"
): Promise<ExpireExtensionSingleResult> {
  const extension = await leaveExtensionRepository.findById(extensionId);

  if (!extension) {
    throw new NotFoundError("LeaveExtension");
  }

  if (extension.status !== LEAVE_REQUEST_STATUS.PENDING) {
    throw new ConflictError(
      `Cannot expire extension in ${extension.status} status`
    );
  }

  return await transaction(async (tx) => {
    const extensionInTx =
      await leaveExtensionRepository.findByIdForUpdate(extensionId, tx);

    if (!extensionInTx) {
      throw new NotFoundError("LeaveExtension");
    }

    if (extensionInTx.status !== LEAVE_REQUEST_STATUS.PENDING) {
      throw new ConflictError(
        `Cannot expire extension in ${extensionInTx.status} status`
      );
    }

    const expiredAt = new Date();

    // Find and close any pending approvals on this extension
    const pendingApprovals =
      await leaveApprovalRepository.findByEntityAndDecision(
        extensionId,
        leaveApprovals.leaveExtensionId,
        LEAVE_APPROVAL_DECISION.PENDING,
        tx
      );

    for (const approval of pendingApprovals) {
      await leaveApprovalRepository.updateDecisionById(
        approval.id,
        LEAVE_APPROVAL_DECISION.REJECTED,
        currentUser.id ?? null,
        reason,
        expiredAt,
        tx
      );
    }

    await leaveExtensionRepository.updateById(
      extensionId,
      {
        status: LEAVE_REQUEST_STATUS.REJECTED,
        rejectedAt: expiredAt,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.REJECT,
      AUDIT_ENTITY_TYPE.LEAVE_EXTENSION,
      extensionId,
      currentUser.id ?? null,
      {
        oldStatus: LEAVE_REQUEST_STATUS.PENDING,
        newStatus: LEAVE_REQUEST_STATUS.REJECTED,
        reason,
        rejectedAt: expiredAt.toISOString(),
      },
      tx
    );

    await outboxService.publish(
      {
        eventType: OUTBOX_EVENT_TYPE.LEAVE_EXTENSION_REJECTED,
        aggregateType: AGGREGATE_TYPE.LEAVE_EXTENSION,
        aggregateId: extensionId,
        payload: {
          leaveId: extensionInTx.leaveRequestId,
          extensionId,
          decision: LEAVE_APPROVAL_DECISION.REJECTED,
          comments: reason,
          reason,
        },
      },
      tx
    );

    return {
      extensionId,
      leaveRequestId: extensionInTx.leaveRequestId,
      newStatus: LEAVE_REQUEST_STATUS.REJECTED,
      expiredAt,
    };
  });
}

/**
 * Scans for pending extensions whose parent link has expired or whose requested end date has passed,
 * closing them out so base leaves can be marked overdue.
 */
export async function expireOverdueExtensions(
  currentUser: ActingRef,
  now: Date = new Date(),
  batchSize: number = BATCH_SIZE
): Promise<ExpireExtensionsBatchResult> {
  const result: ExpireExtensionsBatchResult = {
    total: 0,
    expired: 0,
    skipped: 0,
    errors: [],
  };

  try {
    const expiredExtensions =
      await leaveExtensionRepository.findExpiredPendingExtensions(
        now,
        undefined,
        batchSize
      );

    result.total = expiredExtensions.length;

    for (const extension of expiredExtensions) {
      try {
        await expireSingleExtension(
          extension.id,
          currentUser,
          "Extension expired: parent approval timed out or requested dates passed"
        );
        result.expired++;
      } catch (error) {
        if (error instanceof ConflictError) {
          result.skipped++;
        } else {
          const message =
            error instanceof Error ? error.message : String(error);
          result.errors.push(
            `Failed to expire extension ${extension.id}: ${message}`
          );
          logger.error("Failed to expire extension", {
            extensionId: extension.id,
            error: message,
          });
        }
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result.errors.push(`findExpiredPendingExtensions query failed: ${message}`);
    logger.error("Failed to query expired extensions", { error: message });
  }

  return result;
}
