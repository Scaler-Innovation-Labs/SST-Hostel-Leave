import type { MovementState } from "@/constants/movement";
import { MOVEMENT_STATE } from "@/constants/movement";

// =====================================================
// LEGACY DATA RECONCILIATION RULES
// docs/movement-contract.md §7.6 (Phase 6)
//
// Pure, unit-testable decision logic used by
// scripts/migrate-0022-reconcile-legacy-data.ts so the
// one-time backfill follows exactly the same rules the
// runtime enforces going forward.
// =====================================================

// -----------------------------------------------------
// 1. Location settlement
// -----------------------------------------------------
// Legacy students may hold APPROVED_LEAVE / CHECKED_OUT /
// RETURNED — states the contract removed. Settle them to
// their TRUE physical state:
//   - no open movement session      → IN_HOSTEL (never left)
//   - open session, leave not over  → OUTSIDE_HOSTEL
//   - open session, leave over      → OVERDUE (still outside)
export function settleLocationState(input: {
  openSessionExists: boolean;
  leaveEndAt: Date | null;
  now: Date;
}): MovementState {
  if (!input.openSessionExists) return MOVEMENT_STATE.IN_HOSTEL;
  if (input.leaveEndAt && input.leaveEndAt.getTime() < input.now.getTime()) {
    return MOVEMENT_STATE.OVERDUE;
  }
  return MOVEMENT_STATE.OUTSIDE_HOSTEL;
}

// -----------------------------------------------------
// 2. Overlapping QR-capable leaves
// -----------------------------------------------------
// Contract §4: QR-capable × QR-capable = reject while the
// windows overlap. Legacy rows predate the rule, so keep
// the earliest-created APPROVED QR leaf per student per
// overlapping group and cancel the rest. Non-QR leaves are
// untouched (their overlap is allowed).
export type OverlapCandidate = {
  id: string;
  studentId: string;
  startAt: Date;
  endAt: Date;
  createdAt: Date;
};

export function resolveOverlapCancellations(
  candidates: OverlapCandidate[]
): string[] {
  // Group by student.
  const byStudent = new Map<string, OverlapCandidate[]>();
  for (const c of candidates) {
    const group = byStudent.get(c.studentId) ?? [];
    group.push(c);
    byStudent.set(c.studentId, group);
  }

  const toCancel: string[] = [];
  for (const group of byStudent.values()) {
    // Deterministic order: earliest window first, then earliest created.
    const sorted = [...group].sort((a, b) => {
      if (a.startAt.getTime() !== b.startAt.getTime()) {
        return a.startAt.getTime() - b.startAt.getTime();
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    // Keep the first candidate; cancel any later one whose window overlaps
    // a kept one. Non-overlapping windows start a new kept candidate.
    const kept: OverlapCandidate[] = [];
    for (const c of sorted) {
      const conflicts = kept.some(
        (k) =>
          c.startAt.getTime() <= k.endAt.getTime() &&
          k.startAt.getTime() <= c.endAt.getTime()
      );
      if (conflicts) {
        toCancel.push(c.id);
      } else {
        kept.push(c);
      }
    }
  }

  return toCancel;
}
