import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type ExpireSingleResult = {
  leaveId: string;
  newStatus: string;
  expiredAt: Date;
};

export type ExpireBatchResult = {
  total: number;
  expired: number;
  skipped: number;
  errors: string[];
};

const BATCH_SIZE = 100;

export async function expireSingleLeave(
  leaveId: string,
  currentUser: { id: string }
): Promise<ExpireSingleResult> {
  const leave = await leaveRepository.findById(leaveId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  if (!canTransition(leave.status, LEAVE_ACTION.EXPIRE)) {
    throw new ConflictError(
      `Cannot expire leave in ${leave.status} status`
    );
  }

  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) {
      throw new NotFoundError("LeaveRequest");
    }

    if (!canTransition(leaveInTx.status, LEAVE_ACTION.EXPIRE)) {
      throw new ConflictError(
        `Cannot expire leave in ${leaveInTx.status} status`
      );
    }

    const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.EXPIRE);
    const expiredAt = new Date();

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        expiredAt,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    // Lifecycle invalidation: an expired leave's QR pass must stop working.
    const qrPass = await qrPassRepository.findByLeaveRequestId(
      leaveId,
      tx
    );

    if (qrPass && qrPass.status === QR_STATUS.ACTIVE) {
      await qrPassRepository.invalidate(qrPass.id, tx);
    }

    // Movement transition (if applicable) handled asynchronously by outbox handler

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: leaveInTx.status,
        newStatus: nextState,
        expiredAt: expiredAt.toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_EXPIRED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        expiredAt: expiredAt.toISOString(),
      },
    }, tx);

    return {
      leaveId,
      newStatus: nextState,
      expiredAt,
    };
  });
}

export async function expireOverdueLeaves(
  currentUser: { id: string }
): Promise<ExpireBatchResult> {
  const now = new Date();

  const result: ExpireBatchResult = {
    total: 0,
    expired: 0,
    skipped: 0,
    errors: [],
  };

  // Process in bounded batches so a large backlog cannot starve the worker.
  // Each pass commits its work, so a fresh query only sees unprocessed leaves.
  while (true) {
    const expiredLeaves = await leaveRepository.findExpiredLeaves(now, undefined, BATCH_SIZE);

    if (expiredLeaves.length === 0) {
      break;
    }

    result.total += expiredLeaves.length;

    for (const leave of expiredLeaves) {
      try {
        if (!canTransition(leave.status, LEAVE_ACTION.EXPIRE)) {
          result.skipped++;
          continue;
        }

        await expireSingleLeave(leave.id, currentUser);
        result.expired++;
      } catch (error) {
        result.errors.push(
          `Failed to expire ${leave.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    if (expiredLeaves.length < BATCH_SIZE) {
      break;
    }
  }

  return result;
}

