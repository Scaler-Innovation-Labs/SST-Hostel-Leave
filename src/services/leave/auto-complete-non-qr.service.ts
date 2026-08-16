import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { transaction } from "@/lib/db/transaction";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type AutoCompleteBatchResult = {
  total: number;
  completed: number;
  skipped: number;
  errors: string[];
};

const BATCH_SIZE = 100;

/**
 * Contract T16: a non-QR leave has no movement session to reconcile, so when
 * its window ends it auto-COMPLETES (EXPIRED is the wrong end state for a
 * leave the student never moved against). Runs inside the same lifecycle job
 * as expiry/overdue — one pass, three outcomes.
 *
 * A leave with a PENDING extension is skipped: the extension may still be
 * approved to widen the window, and completing it would orphan the request.
 */
export async function autoCompleteNonQrLeaves(
  currentUser: { id: string }
): Promise<AutoCompleteBatchResult> {
  const now = new Date();

  const result: AutoCompleteBatchResult = {
    total: 0,
    completed: 0,
    skipped: 0,
    errors: [],
  };

  // Process in bounded batches so a large backlog cannot starve the worker.
  // Each pass commits its work, so a fresh query only sees unprocessed leaves.
  while (true) {
    const dueLeaves = await leaveRepository.findAutoCompleteDueNonQrLeaves(now, undefined, BATCH_SIZE);

    if (dueLeaves.length === 0) {
      break;
    }

    result.total += dueLeaves.length;

    for (const leave of dueLeaves) {
      try {
        const outcome = await completeNonQrLeave(leave.id, currentUser);
        if (outcome === "completed") {
          result.completed++;
        } else {
          result.skipped++;
        }
      } catch (error) {
        result.errors.push(
          `Failed to auto-complete ${leave.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    if (dueLeaves.length < BATCH_SIZE) {
      break;
    }
  }

  return result;
}

async function completeNonQrLeave(
  leaveId: string,
  currentUser: { id: string }
): Promise<"completed" | "skipped"> {
  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx || leaveInTx.status !== LEAVE_REQUEST_STATUS.APPROVED) {
      return "skipped" as const;
    }

    // Re-check inside the transaction: a pending extension would be orphaned
    // by completing the leave.
    const extensions =
      await leaveExtensionRepository.findByLeaveRequestId(leaveId, tx);
    if (
      extensions.some(
        (extension) => extension.status === LEAVE_REQUEST_STATUS.PENDING
      )
    ) {
      return "skipped" as const;
    }

    const completedAt = new Date();

    await leaveRepository.updateById(
      leaveId,
      {
        status: LEAVE_REQUEST_STATUS.COMPLETED,
        completedAt,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: LEAVE_REQUEST_STATUS.APPROVED,
        newStatus: LEAVE_REQUEST_STATUS.COMPLETED,
        completedAt: completedAt.toISOString(),
        autoCompleted: true,
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_COMPLETED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        completedAt: completedAt.toISOString(),
      },
    }, tx);

    return "completed" as const;
  });
}
