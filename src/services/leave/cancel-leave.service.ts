import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_MODE } from "@/constants/leave/qr-mode";
import { MOVEMENT_EVENT } from "@/constants/movement/movement-event";
import { MOVEMENT_METHOD } from "@/constants/movement/movement-method";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { leaveExtensionRepository } from "@/db/repositories/leave/leave-extension.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { CancelLeaveDto } from "@/dto/leave/cancel-leave.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { transaction } from "@/lib/db/transaction";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { canTransition, getNextState, LEAVE_ACTION } from "@/lib/workflows/leave-state-machine";
import { auditService } from "@/services/audit/audit.service";
import { recordMovement } from "@/services/movement/record-movement.service";
import { outboxService } from "@/services/outbox/outbox.service";
import { assertCanAccessLeave } from "@/services/shared/authorization.service";

export type CancelLeaveResult = {
  leaveId: string;
  newStatus: string;
  qrInvalidated: boolean;
};

export async function cancelLeave(
  leaveId: string,
  dto: CancelLeaveDto,
  currentUser: CurrentUser
): Promise<CancelLeaveResult> {
  const leave = await leaveRepository.findById(leaveId);

  if (!leave) throw new NotFoundError("LeaveRequest");

  await assertCanAccessLeave(currentUser, leave);

  if (!canTransition(leave.status, LEAVE_ACTION.CANCEL)) {
    throw new ConflictError(
      `Cannot cancel leave in ${leave.status} status`
    );
  }

  if (leave.status === LEAVE_REQUEST_STATUS.APPROVED) {
    const student = await studentRepository.findById(leave.studentId);

    if (!student) throw new NotFoundError("Student");

    const qrPass = await qrPassRepository.findByLeaveRequestId(leave.id);
    if (qrPass && (Boolean(qrPass.firstScanAt) || qrPass.status === QR_STATUS.USED)) {
      throw new ConflictError("Cannot cancel active leave after student has already scanned out");
    }

    const leaveType = leave.leaveTypeId ? await leaveTypeRepository.findById(leave.leaveTypeId) : null;
    const isReturnOnlyOrRecurring =
      leaveType?.qrMode === QR_MODE.RETURN_ONLY ||
      leaveType?.qrMode === QR_MODE.DAILY_RECURRING ||
      leaveType?.code === "LATE_ENTRY" ||
      leaveType?.code === "LATE_STAY_COLLEGE";

    if (
      !isReturnOnlyOrRecurring &&
      student.currentLocationState !== MOVEMENT_STATE.IN_HOSTEL &&
      student.currentLocationState !== MOVEMENT_STATE.APPROVED_LEAVE
    ) {
      throw new ConflictError(
        "Cannot cancel active leave after student has exited"
      );
    }
  }

  return await transaction(async (tx) => {
    // Lock hierarchy: leave_extensions -> leave_requests -> students.
    // Lock pending extensions first to prevent deadlock with concurrent extension approvals.
    const pendingExtensions =
      await leaveExtensionRepository.lockPendingByLeaveRequestId(leaveId, tx);

    const leaveInTx = await leaveRepository.findByIdForUpdate(leaveId, tx);

    if (!leaveInTx) throw new NotFoundError("LeaveRequest");

    if (!canTransition(leaveInTx.status, LEAVE_ACTION.CANCEL)) {
      throw new ConflictError(
        `Cannot cancel leave in ${leaveInTx.status} status`
      );
    }

    if (leaveInTx.status === LEAVE_REQUEST_STATUS.APPROVED) {
      const student = await studentRepository.findById(
        leaveInTx.studentId,
        tx
      );

      if (!student) throw new NotFoundError("Student");

      const qrPassInTx = await qrPassRepository.findByLeaveRequestId(leaveId, tx);
      if (qrPassInTx && (Boolean(qrPassInTx.firstScanAt) || qrPassInTx.status === QR_STATUS.USED)) {
        throw new ConflictError("Cannot cancel active leave after student has already scanned out");
      }

      const leaveType = leaveInTx.leaveTypeId ? await leaveTypeRepository.findById(leaveInTx.leaveTypeId, tx) : null;
      const isReturnOnlyOrRecurring =
        leaveType?.qrMode === QR_MODE.RETURN_ONLY ||
        leaveType?.qrMode === QR_MODE.DAILY_RECURRING ||
        leaveType?.code === "LATE_ENTRY" ||
        leaveType?.code === "LATE_STAY_COLLEGE";

      if (
        !isReturnOnlyOrRecurring &&
        student.currentLocationState !== MOVEMENT_STATE.IN_HOSTEL &&
        student.currentLocationState !== MOVEMENT_STATE.APPROVED_LEAVE
      ) {
        throw new ConflictError(
          "Cannot cancel active leave after student has exited"
        );
      }
    }

    const nextState = getNextState(leaveInTx.status, LEAVE_ACTION.CANCEL);
    const cancelledAt = new Date();

    await leaveRepository.updateById(
      leaveId,
      {
        status: nextState,
        cancelledAt,
        currentStepKey: null,
        currentStepOrder: null,
      },
      tx
    );

    // Mark all pending approvals as cancelled
    await leaveApprovalRepository.updateDecisionByLeaveRequestId(
      leaveId,
      LEAVE_APPROVAL_DECISION.CANCELLED,
      cancelledAt,
      tx
    );

    // Extension approvals point at the extension, not the leave, so they are
    // invisible to the bulk update above. Cancel them and their pending
    // extension rows together; otherwise an old approval link could approve
    // the extension and move this cancelled leave back to APPROVED.
    const pendingExtensionIds = pendingExtensions.map((extension) => extension.id);

    if (pendingExtensionIds.length > 0) {
      await leaveExtensionRepository.cancelPendingByLeaveRequestId(leaveId, tx);
      await leaveApprovalRepository.updateDecisionByExtensionIds(
        pendingExtensionIds,
        LEAVE_APPROVAL_DECISION.CANCELLED,
        cancelledAt,
        tx
      );
    }

    // Proactively cancel any pending outbox events for parent approval/SMS
    // so the worker does not send SMS to parents after cancellation.
    await outboxRepository.cancelPendingByAggregateIds(
      [leaveId, ...pendingExtensionIds],
      "Leave cancelled before SMS dispatch",
      [
        OUTBOX_EVENT_TYPE.PARENT_APPROVAL_REQUIRED,
        OUTBOX_EVENT_TYPE.NOTIFICATION_REQUESTED,
      ],
      tx
    );

    let qrInvalidated = false;

    if (leaveInTx.status === LEAVE_REQUEST_STATUS.APPROVED) {
      const qrPass = await qrPassRepository.findByLeaveRequestId(
        leaveId,
        tx
      );

      if (qrPass && qrPass.status === QR_STATUS.ACTIVE) {
        const invalidated = await qrPassRepository.invalidate(qrPass.id, tx);
        qrInvalidated = invalidated !== null;
      }

      const leaveType = leaveInTx.leaveTypeId ? await leaveTypeRepository.findById(leaveInTx.leaveTypeId, tx) : null;
      const isReturnOnlyOrRecurring =
        leaveType?.qrMode === QR_MODE.RETURN_ONLY ||
        leaveType?.qrMode === QR_MODE.DAILY_RECURRING ||
        leaveType?.code === "LATE_ENTRY" ||
        leaveType?.code === "LATE_STAY_COLLEGE";

      const studentInTx = await studentRepository.findById(leaveInTx.studentId, tx);

      if (isReturnOnlyOrRecurring && studentInTx?.currentLocationState === MOVEMENT_STATE.OUTSIDE_HOSTEL) {
        await recordMovement({
          studentId: leaveInTx.studentId,
          leaveRequestId: leaveId,
          qrPassId: qrPass?.id,
          fromState: MOVEMENT_STATE.OUTSIDE_HOSTEL,
          toState: MOVEMENT_STATE.IN_HOSTEL,
          eventType: MOVEMENT_EVENT.QR_INVALIDATED,
          movementMethod: MOVEMENT_METHOD.SYSTEM,
          dbClient: tx,
        });
      }

      // Movement transition (if applicable) handled asynchronously by outbox handler
    }

    await auditService.record(
      AUDIT_ACTION.CANCEL,
      AUDIT_ENTITY_TYPE.LEAVE_REQUEST,
      leaveId,
      currentUser.id,
      {
        oldStatus: leaveInTx.status,
        newStatus: nextState,
        reason: dto.reason,
        qrInvalidated,
      },
      tx
    );

    await outboxService.publish({
      eventType: OUTBOX_EVENT_TYPE.LEAVE_CANCELLED,
      aggregateType: AGGREGATE_TYPE.LEAVE_REQUEST,
      aggregateId: leaveId,
      payload: {
        leaveId,
        studentId: leaveInTx.studentId,
        reason: dto.reason ?? "",
      },
    }, tx);

    return {
      leaveId,
      newStatus: nextState,
      qrInvalidated,
    };
  });
}

