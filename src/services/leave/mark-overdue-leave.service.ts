import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { recordMovement } from "@/services/movement/record-movement.service";
import { outboxService } from "@/services/outbox/outbox.service";

export type MarkOverdueSingleResult = {
  leaveId: string;
  newStatus: string;
  overdueAt: Date;
};

export type MarkOverdueBatchResult = {
  total: number;
  overdue: number;
  skipped: number;
  errors: string[];
};

const BATCH_SIZE = 100;

/**
 * Marks an approved leave as OVERDUE: the student checked out for the leave
 * (QR first-scanned) but has not returned to the hostel by the leave end
 * date. Unlike EXPIRED (never checked out), the return QR stays scannable so
 * the student can still check back in and complete the leave.
 */
export async function markOverdueSingleLeave(
  leaveId: string,
  currentUser: { id: string }
): Promise<MarkOverdueSingleResult> {
  const leave = await leaveRepository.findById(leaveId);

  if (!leave) {
    throw new NotFoundError("LeaveRequest");
  }

  if (!canTransition(leave.status, LEAVE_ACTION.MARK_OVERDUE)) {
    throw new ConflictError(
      `Cannot mark leave overdue in ${leave.status} status`
    );
  }

  return await transaction(async (tx) => {
    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) {
      throw new NotFoundError("LeaveRequest");
    }

    if (!canTransition(leaveInTx.status, LEAVE_ACTION.MARK_OVERDUE)) {
      throw new ConflictError(
        `Cannot mark leave overdue in ${leaveInTx.status} status`
      );
    }

    const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.MARK_OVERDUE);
    const overdueAt = new Date();

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    // Contract T7: ONE overdue engine — leave status, physical location and
    // the AUTO_OVERDUE event move together in this single transaction, not
    // via the async outbox handler. The return QR is intentionally NOT
    // invalidated: an overdue student may still use it to check back in and
    // complete the leave.
    const student = await studentRepository.findById(
      leaveInTx.studentId,
      tx
    );

    if (
      student &&
      (student.currentLocationState === MOVEMENT_STATE.OUTSIDE_HOSTEL ||
        student.currentLocationState === MOVEMENT_STATE.CHECKED_OUT)
    ) {
      const openPass =
        await qrPassRepository.findOpenSessionPassForStudent(
          leaveInTx.studentId,
          tx
        );

      await recordMovement({
        studentId: leaveInTx.studentId,
        leaveRequestId: leaveId,
        qrPassId: openPass?.id ?? undefined,
        fromState: student.currentLocationState,
        toState: MOVEMENT_STATE.OVERDUE,
        eventType: MOVEMENT_EVENT.AUTO_OVERDUE,
        movementMethod: MOVEMENT_METHOD.SYSTEM,
        recordedBy: currentUser.id,
        isManualOverride: true,
        dbClient: tx,
      });
    }

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: leaveInTx.status,
        newStatus: nextState,
        overdueAt: overdueAt.toISOString(),
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_OVERDUE,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        overdueAt: overdueAt.toISOString(),
      },
    }, tx);

    return {
      leaveId,
      newStatus: nextState,
      overdueAt,
    };
  });
}

export async function markOverdueLeaves(
  currentUser: { id: string }
): Promise<MarkOverdueBatchResult> {
  const now = new Date();

  const result: MarkOverdueBatchResult = {
    total: 0,
    overdue: 0,
    skipped: 0,
    errors: [],
  };

  // Process in bounded batches so a large backlog cannot starve the worker.
  // Each pass commits its work, so a fresh query only sees unprocessed leaves.
  while (true) {
    const overdueLeaves = await leaveRepository.findOverdueLeaves(now, undefined, BATCH_SIZE);

    if (overdueLeaves.length === 0) {
      break;
    }

    result.total += overdueLeaves.length;

    for (const leave of overdueLeaves) {
      try {
        if (!canTransition(leave.status, LEAVE_ACTION.MARK_OVERDUE)) {
          result.skipped++;
          continue;
        }

        await markOverdueSingleLeave(leave.id, currentUser);
        result.overdue++;
      } catch (error) {
        result.errors.push(
          `Failed to mark overdue ${leave.id}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    if (overdueLeaves.length < BATCH_SIZE) {
      break;
    }
  }

  return result;
}