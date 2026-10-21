import { QR_MODE } from "@/constants/leave/qr-mode";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { getQrExpiryFromLeaveEnd } from "@/constants/movement/qr-window";
import { AGGREGATE_TYPE } from "@/constants/outbox/aggregate-types";
import { OUTBOX_EVENT_TYPE } from "@/constants/outbox/event-types";
import type { LeaveRequest } from "@/db/repositories/leave/leave.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import { sha256, toHex } from "@/lib/crypto";
import type { DbClient } from "@/lib/db/transaction";
import { encryptQrToken } from "@/lib/qr-token-crypto";
import { outboxService } from "@/services/outbox/outbox.service";

/**
 * Issues the single gate pass for a leave that has just reached APPROVED.
 * Shared by the staff and parent terminal-approval paths so both produce the
 * same usable credential. The raw token is never persisted in plaintext.
 */
export async function issueQrPassForApprovedLeave(
  leave: LeaveRequest,
  tx: DbClient
): Promise<void> {
  const leaveType = await leaveTypeRepository.findById(leave.leaveTypeId, tx);

  if (!leaveType || leaveType.qrMode === QR_MODE.NONE) {
    return;
  }

  const existing = await qrPassRepository.findByLeaveRequestId(leave.id, tx);
  if (existing) {
    return;
  }

  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = toHex(raw);
  const tokenHash = await sha256(token);
  const tokenEnc = await encryptQrToken(token);
  const qrType =
    leaveType.qrMode === QR_MODE.RETURN_ONLY ? "LEAVE_RETURN" : "LEAVE_EXIT";

  const pass = await qrPassRepository.create({
    leaveRequestId: leave.id,
    studentId: leave.studentId,
    qrType,
    tokenHash,
    tokenEnc,
    status: QR_STATUS.ACTIVE,
    validFrom: leave.startAt,
    expiresAt: getQrExpiryFromLeaveEnd(leave.endAt),
  }, tx);

  await outboxService.publish({
    eventType: OUTBOX_EVENT_TYPE.QR_GENERATED,
    aggregateType: AGGREGATE_TYPE.QR_PASS,
    aggregateId: pass.id,
    payload: {
      qrPassId: pass.id,
      leaveRequestId: leave.id,
      studentId: leave.studentId,
      qrType,
    },
  }, tx);
}

/**
 * Contract T14: an extended leave's pass window grows with the new end date.
 * The pass status is left untouched - an open session keeps its return QR.
 */
export async function extendQrPassWindow(
  leaveRequestId: string,
  endAt: Date,
  tx: DbClient
): Promise<void> {
  const pass = await qrPassRepository.findByLeaveRequestId(leaveRequestId, tx);

  if (pass && pass.status === QR_STATUS.ACTIVE) {
    await qrPassRepository.updateExpiresAt(
      pass.id,
      getQrExpiryFromLeaveEnd(endAt),
      tx
    );
  }
}

/**
 * A directly completed leave must not leave a usable credential behind.
 * An unused pass is invalidated; a pass that already opened a movement
 * session is closed as USED so the session is resolved rather than leaving a
 * phantom open QR.
 */
export async function retireQrPassOnLeaveCompletion(
  leaveRequestId: string,
  tx: DbClient
): Promise<string | null> {
  const pass = await qrPassRepository.findByLeaveRequestId(leaveRequestId, tx);

  if (!pass || pass.status !== QR_STATUS.ACTIVE) {
    return pass?.status ?? null;
  }

  if (pass.firstScanAt) {
    const closed = await qrPassRepository.markAsClosed(pass.id, tx);
    return closed?.status ?? null;
  }

  const invalidated = await qrPassRepository.invalidate(pass.id, tx);
  return invalidated?.status ?? null;
}
