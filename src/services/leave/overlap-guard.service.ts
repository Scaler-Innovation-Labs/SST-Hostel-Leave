import { QR_MODE } from "@/constants/leave/qr-mode";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
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
 * Contract §4 (MVP overlap policy) — deterministic, applies at submission and
 * extension approval, never at scan time:
 *
 *   QR-enabled new leave  × any overlapping live leave  → reject
 *   non-QR new leave      × overlapping QR-enabled leave → reject
 *   non-QR new leave      × overlapping non-QR leave     → allow, unless the
 *     overlapping leave is the SAME leave type (legacy guard preserved).
 *
 * Overlap = `new.startAt <= existing.endAt AND existing.startAt <= new.endAt`
 * over PENDING / APPROVED / OVERDUE leaves of the same student.
 */
export async function assertNoConflictingOverlap(params: {
  studentId: string;
  startAt: Date;
  endAt: Date;
  /** qrMode of the leave being created / extended. */
  qrMode: string | null | undefined;
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

  const newMovementCapable = isMovementCapable(params.qrMode);

  if (newMovementCapable) {
    throw new ConflictError(
      "Overlapping leave exists: another leave overlaps this QR-enabled leave's window"
    );
  }

  const qrConflict = overlapping.find((row) =>
    isMovementCapable(row.leaveType?.qrMode)
  );
  if (qrConflict) {
    throw new ConflictError(
      "Overlapping QR-enabled leave exists"
    );
  }

  const sameType = overlapping.find(
    (row) => row.leave.leaveTypeId === params.leaveTypeId
  );
  if (sameType) {
    throw new ConflictError("Overlapping leave exists");
  }
}
