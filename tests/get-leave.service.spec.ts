// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindByIdWithRelations = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByIdWithRelations: (...args: any[]) => mockFindByIdWithRelations(...args),
  },
}));

import { getLeave } from "@/services/leave/get-leave.service";
import { NotFoundError } from "@/lib/errors";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("getLeave service", () => {
  it("returns a leave request when found", async () => {
    const leave = {
      id: "LR1",
      requestNumber: "LR-2026-001",
      status: "APPROVED",
      student: { id: "S1", name: "Test Student" },
      leaveType: { id: "LT1", code: "HOME_PASS" },
    };
    mockFindByIdWithRelations.mockResolvedValue(leave);

    const result = await getLeave("LR1");

    expect(result).toEqual(leave);
    expect(mockFindByIdWithRelations).toHaveBeenCalledWith("LR1");
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindByIdWithRelations.mockResolvedValue(null);

    await expect(
      getLeave("NONEXISTENT")
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns leave with approvals when relation is loaded", async () => {
    const leave = {
      id: "LR2",
      requestNumber: "LR-2026-002",
      status: "PENDING",
      approvals: [
        { id: "A1", stepOrder: 1, decision: "PENDING" },
        { id: "A2", stepOrder: 2, decision: "PENDING" },
      ],
    };
    mockFindByIdWithRelations.mockResolvedValue(leave);

    const result = await getLeave("LR2");

    expect(result.approvals).toHaveLength(2);
    expect(result.approvals[0].stepOrder).toBe(1);
  });

  it("returns leave with documents when relation is loaded", async () => {
    const leave = {
      id: "LR3",
      requestNumber: "LR-2026-003",
      status: "APPROVED",
      documents: [
        { id: "D1", fileName: "consent.pdf" },
      ],
    };
    mockFindByIdWithRelations.mockResolvedValue(leave);

    const result = await getLeave("LR3");

    expect(result.documents).toHaveLength(1);
    expect(result.documents[0].fileName).toBe("consent.pdf");
  });
});
