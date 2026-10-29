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
 * Overlap policy:
 * Overlapping leaves of DIFFERENT types/kinds CAN be raised.
 * Only overlapping leaves of the SAME leave type are rejected.
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

  // Overlapping leaves of different types/kinds can be raised.
  // Reject only when there is an overlapping leave of the same type.
  const sameType = overlapping.find(
    (row) => row.leave.leaveTypeId === params.leaveTypeId
  );
  if (sameType) {
    throw new ConflictError("Overlapping leave exists");
  }
}
