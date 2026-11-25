import { QR_MODE } from "@/constants/leave/qr-mode";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { type db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";

/**
 * A leave type is "movement-capable" when it can produce a QR that changes the
 * student's physical location. `OPTIONAL` counts, since the leave may still
 * compete for one exit / one return / one QR.
 */
export function isMovementCapable(
  qrMode: string | null | undefined
): boolean {
  return !!qrMode && qrMode !== QR_MODE.NONE;
}

/**
 * Overlap policy:
 * - Overlapping leaves of the SAME leave type are always rejected.
 * - Overlapping leaves of DIFFERENT types are allowed ONLY when they do not
 *   both have QR passes (i.e. at most one is movement-capable / qrMode !== NONE).
 *
 * Overlap = `new.startAt <= existing.endAt AND existing.startAt <= new.endAt`
 * over PENDING / APPROVED / OVERDUE leaves of the same student.
 */
export async function assertNoConflictingOverlap(params: {
  studentId: string;
  startAt: Date;
  endAt: Date;
  /** qrMode of the leave being created / extended. */
  qrMode?: string | null | undefined;
  /** leaveTypeId of the leave being created / extended (same-type guard). */
  leaveTypeId: string;
  /** For extensions: the leave whose own window is being widened. */
  excludeLeaveRequestId?: string;
  dbClient?: Pick<typeof db, "select">;
}): Promise<void> {
  const overlapping = await leaveRepository.findOverlappingLeaves(
    params.studentId,
    params.startAt,
    params.endAt,
    {
      dbClient: params.dbClient,
      excludeLeaveRequestId: params.excludeLeaveRequestId,
    }
  );

  if (overlapping.length === 0) return;

  // 1. Same leave type is always rejected.
  const sameType = overlapping.find(
    (row) => row.leave.leaveTypeId === params.leaveTypeId
  );
  if (sameType) {
    throw new ConflictError("Overlapping leave exists");
  }

  // 2. Different leave types are allowed only if they don't compete for a QR pass.
  let incomingQrMode = params.qrMode;
  if (incomingQrMode === undefined) {
    const leaveType = await leaveTypeRepository.findById(
      params.leaveTypeId,
      params.dbClient
    );
    incomingQrMode = leaveType?.qrMode ?? null;
  }

  if (isMovementCapable(incomingQrMode)) {
    const conflictingQrLeave = overlapping.find((row) =>
      isMovementCapable(row.leaveType?.qrMode)
    );
    if (conflictingQrLeave) {
      throw new ConflictError("Overlapping leave with QR pass exists");
    }
  }
}
