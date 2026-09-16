import { systemActor } from "@/constants/audit/actor";
import { type AutoCompleteBatchResult, autoCompleteNonQrLeaves } from "@/services/leave/auto-complete-non-qr.service";
import { type ExpireBatchResult, expireOverdueLeaves } from "@/services/leave/expire-leave.service";
import { type MarkOverdueBatchResult, markOverdueLeaves } from "@/services/leave/mark-overdue-leave.service";

// Scheduled pass: no logged-in user caused these transitions, so the actor
// carries a null id plus the job name (recorded as an actor descriptor in
// the audit metadata instead of the uuid FK column).
const SYSTEM_USER = systemActor("expire-leaves");

export type ExpireLeavesJobResult = {
  job: "expire-leaves";
  /** T16 — non-QR leaves auto-COMPLETED at window end. */
  completed: AutoCompleteBatchResult;
  /** T6 — APPROVED QR leaves never scanned → EXPIRED. */
  expired: ExpireBatchResult;
  /** T7 — open movement sessions past endAt → OVERDUE (atomic). */
  overdue: MarkOverdueBatchResult;
};

export async function runExpireLeavesJob(): Promise<ExpireLeavesJobResult> {
  // Order matters: T16 completes non-QR leaves first so the expiry pass (T6)
  // only ever sees QR leaves.
  const completed = await autoCompleteNonQrLeaves(SYSTEM_USER);
  const expired = await expireOverdueLeaves(SYSTEM_USER);
  const overdue = await markOverdueLeaves(SYSTEM_USER);

  return {
    job: "expire-leaves",
    completed,
    expired,
    overdue,
  };
}