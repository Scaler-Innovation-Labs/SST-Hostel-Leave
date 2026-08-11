// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByFilters = vi.fn();
const mockFindById = vi.fn();
const mockVerifyStudentOwnership = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  verifyStudentOwnership: (...args: any[]) => mockVerifyStudentOwnership(...args),
  isStaffScopeRestricted: () => false,
  getScopedHostelIds: () => [],
}));

import { listApprovals } from "@/services/leave/list-approvals.service";

const MOCK_RESULT = {
  items: [{ id: "A1", decision: "PENDING", approverRoleCode: null, leaveRequest: null, studentName: null, studentRollNumber: null, roomNumber: null, hostelName: null, departmentName: null, leaveTypeName: null }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByFilters.mockResolvedValue(MOCK_RESULT);
  mockFindById.mockResolvedValue(null);
  mockVerifyStudentOwnership.mockResolvedValue(undefined);
});

describe("listApprovals service", () => {
  it("returns paginated approvals for admin", async () => {
    const result = await listApprovals(
      { page: 1, limit: 20 },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        approverUserId: undefined,
        excludeLeaveStatuses: ["CANCELLED"],
      })
    );
  });

  it("filters by leaveRequestId and verifies ownership", async () => {
    mockFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });

    await listApprovals(
      { page: 1, limit: 20, leaveRequestId: "LR1" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindById).toHaveBeenCalledWith("LR1");
    expect(mockVerifyStudentOwnership).toHaveBeenCalledWith(
      { id: "U1", roles: ["ADMIN"] },
      "S1"
    );
  });

  it("throws when verifyStudentOwnership fails", async () => {
    mockFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });
    mockVerifyStudentOwnership.mockRejectedValue(new Error("Not authorized"));

    await expect(
      listApprovals(
        { page: 1, limit: 20, leaveRequestId: "LR1" },
        { id: "U2", roles: ["STUDENT"] }
      )
    ).rejects.toThrow("Not authorized");
  });

  it("scopes to POC user when current user has POC role", async () => {
    await listApprovals(
      { page: 1, limit: 20 },
      { id: "POC1", roles: ["POC"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ approverUserId: "POC1" })
    );
  });

  it("passes status filter", async () => {
    await listApprovals(
      { page: 1, limit: 20, status: "PENDING" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING" })
    );
  });

  it("passes date range filters", async () => {
    await listApprovals(
      { page: 1, limit: 20, dateFrom: "2026-06-01", dateTo: "2026-06-10" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: new Date("2026-06-01"),
        dateTo: new Date("2026-06-10"),
      })
    );
  });

  it("passes hostelId filter", async () => {
    await listApprovals(
      { page: 1, limit: 20, hostelId: "H1" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ hostelId: "H1" })
    );
  });

  it("passes leaveTypeId filter", async () => {
    await listApprovals(
      { page: 1, limit: 20, leaveTypeId: "LT1" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ leaveTypeId: "LT1" })
    );
  });

  it("does not scope to POC for SUPER_ADMIN", async () => {
    await listApprovals(
      { page: 1, limit: 20 },
      { id: "SA1", roles: ["SUPER_ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ approverUserId: undefined })
    );
  });
});
