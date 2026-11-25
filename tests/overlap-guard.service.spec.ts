import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindOverlappingLeaves, mockFindLeaveTypeById } = vi.hoisted(() => ({
  mockFindOverlappingLeaves: vi.fn(),
  mockFindLeaveTypeById: vi.fn(),
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findOverlappingLeaves: (...args: unknown[]) => mockFindOverlappingLeaves(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-type.repository", () => ({
  leaveTypeRepository: {
    findById: (...args: unknown[]) => mockFindLeaveTypeById(...args),
  },
}));

import { ConflictError } from "@/lib/errors";
import { assertNoConflictingOverlap } from "@/services/leave/overlap-guard.service";

describe("assertNoConflictingOverlap", () => {
  const baseParams = {
    studentId: "S1",
    startAt: new Date("2026-11-25T10:00:00Z"),
    endAt: new Date("2026-11-26T10:00:00Z"),
    leaveTypeId: "LT_NEW",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockFindOverlappingLeaves.mockResolvedValue([]);
    mockFindLeaveTypeById.mockResolvedValue(null);
  });

  it("allows when there are no overlapping leaves", async () => {
    await expect(
      assertNoConflictingOverlap({ ...baseParams, qrMode: "BOTH" })
    ).resolves.toBeUndefined();
  });

  it("rejects overlapping leave of the same type even without QR", async () => {
    mockFindOverlappingLeaves.mockResolvedValue([
      { leave: { id: "L1", leaveTypeId: "LT_NEW" }, leaveType: { qrMode: "NONE" } },
    ]);

    await expect(
      assertNoConflictingOverlap({ ...baseParams, qrMode: "NONE" })
    ).rejects.toThrow(ConflictError);
  });

  it("rejects overlapping leaves of different types when both have QR passes", async () => {
    mockFindOverlappingLeaves.mockResolvedValue([
      { leave: { id: "L1", leaveTypeId: "LT_EXISTING" }, leaveType: { qrMode: "BOTH" } },
    ]);

    await expect(
      assertNoConflictingOverlap({ ...baseParams, qrMode: "RETURN_ONLY" })
    ).rejects.toThrow("Overlapping leave with QR pass exists");
  });

  it("allows overlapping leaves of different types when incoming leave has no QR pass", async () => {
    mockFindOverlappingLeaves.mockResolvedValue([
      { leave: { id: "L1", leaveTypeId: "LT_EXISTING" }, leaveType: { qrMode: "BOTH" } },
    ]);

    await expect(
      assertNoConflictingOverlap({ ...baseParams, qrMode: "NONE" })
    ).resolves.toBeUndefined();
  });

  it("allows overlapping leaves of different types when existing leave has no QR pass", async () => {
    mockFindOverlappingLeaves.mockResolvedValue([
      { leave: { id: "L1", leaveTypeId: "LT_EXISTING" }, leaveType: { qrMode: "NONE" } },
    ]);

    await expect(
      assertNoConflictingOverlap({ ...baseParams, qrMode: "BOTH" })
    ).resolves.toBeUndefined();
  });

  it("resolves incoming qrMode from leaveTypeRepository when omitted", async () => {
    mockFindOverlappingLeaves.mockResolvedValue([
      { leave: { id: "L1", leaveTypeId: "LT_EXISTING" }, leaveType: { qrMode: "BOTH" } },
    ]);
    mockFindLeaveTypeById.mockResolvedValue({ id: "LT_NEW", qrMode: "BOTH" });

    await expect(assertNoConflictingOverlap(baseParams)).rejects.toThrow(
      "Overlapping leave with QR pass exists"
    );
  });
});
