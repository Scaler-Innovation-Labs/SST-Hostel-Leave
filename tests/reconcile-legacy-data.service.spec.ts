import { describe, expect, it } from "vitest";

import { MOVEMENT_STATE } from "@/constants/movement";
import {
  resolveOverlapCancellations,
  settleLocationState,
} from "@/services/maintenance/reconcile-legacy-data.service";

const d = (iso: string) => new Date(iso);

describe("settleLocationState", () => {
  it("settles a legacy APPROVED_LEAVE student with no open session to IN_HOSTEL", () => {
    expect(
      settleLocationState({
        openSessionExists: false,
        leaveEndAt: null,
        now: d("2026-08-16T12:00:00Z"),
      })
    ).toBe(MOVEMENT_STATE.IN_HOSTEL);
  });

  it("settles a student with an open session inside its window to OUTSIDE_HOSTEL", () => {
    expect(
      settleLocationState({
        openSessionExists: true,
        leaveEndAt: d("2026-08-20T12:00:00Z"),
        now: d("2026-08-16T12:00:00Z"),
      })
    ).toBe(MOVEMENT_STATE.OUTSIDE_HOSTEL);
  });

  it("settles a student with an open session past its leave end to OVERDUE", () => {
    expect(
      settleLocationState({
        openSessionExists: true,
        leaveEndAt: d("2026-08-15T12:00:00Z"),
        now: d("2026-08-16T12:00:00Z"),
      })
    ).toBe(MOVEMENT_STATE.OVERDUE);
  });

  it("settles an open session with no leave reference to OUTSIDE_HOSTEL", () => {
    expect(
      settleLocationState({
        openSessionExists: true,
        leaveEndAt: null,
        now: d("2026-08-16T12:00:00Z"),
      })
    ).toBe(MOVEMENT_STATE.OUTSIDE_HOSTEL);
  });
});

describe("resolveOverlapCancellations", () => {
  const student = "stu-1";
  const cand = (id: string, start: string, end: string, created: string) => ({
    id,
    studentId: student,
    startAt: d(start),
    endAt: d(end),
    createdAt: d(created),
  });

  it("keeps non-overlapping leaves for the same student", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-05T00:00:00Z", "2026-07-01T00:00:00Z"),
      cand("b", "2026-08-06T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-02T00:00:00Z"),
    ];
    expect(resolveOverlapCancellations(leaves)).toEqual([]);
  });

  it("cancels the later-created leaf when two QR leaves overlap", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-01T00:00:00Z"),
      cand("b", "2026-08-05T00:00:00Z", "2026-08-15T00:00:00Z", "2026-07-02T00:00:00Z"),
    ];
    expect(resolveOverlapCancellations(leaves)).toEqual(["b"]);
  });

  it("keeps the earliest-created leaf when windows are identical", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-02T00:00:00Z"),
      cand("b", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-01T00:00:00Z"),
    ];
    expect(resolveOverlapCancellations(leaves)).toEqual(["a"]);
  });

  it("handles a chain: a overlaps b, b overlaps c, a does not overlap c", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-01T00:00:00Z"),
      cand("b", "2026-08-09T00:00:00Z", "2026-08-15T00:00:00Z", "2026-07-02T00:00:00Z"),
      cand("c", "2026-08-14T00:00:00Z", "2026-08-20T00:00:00Z", "2026-07-03T00:00:00Z"),
    ];
    // a is kept; b overlaps a → cancelled; c overlaps b but not a → kept.
    expect(resolveOverlapCancellations(leaves)).toEqual(["b"]);
  });

  it("treats two students independently", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-01T00:00:00Z"),
      {
        id: "b",
        studentId: "stu-2",
        startAt: d("2026-08-05T00:00:00Z"),
        endAt: d("2026-08-15T00:00:00Z"),
        createdAt: d("2026-07-02T00:00:00Z"),
      },
    ];
    // Same window overlap but different students → nothing cancelled.
    expect(resolveOverlapCancellations(leaves)).toEqual([]);
  });

  // Matches the repo predicate (endAt >= startAt AND startAt <= endAt): a
  // window whose end equals the next window's start still counts as overlap,
  // so the later leaf is cancelled.
  it("treats touching windows (end == next start) as overlapping", () => {
    const leaves = [
      cand("a", "2026-08-01T00:00:00Z", "2026-08-10T00:00:00Z", "2026-07-01T00:00:00Z"),
      cand("b", "2026-08-10T00:00:00Z", "2026-08-15T00:00:00Z", "2026-07-02T00:00:00Z"),
    ];
    expect(resolveOverlapCancellations(leaves)).toEqual(["b"]);
  });

  it("returns nothing for an empty input", () => {
    expect(resolveOverlapCancellations([])).toEqual([]);
  });
});
