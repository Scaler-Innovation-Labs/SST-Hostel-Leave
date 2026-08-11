// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByFilters = vi.fn();
const mockFindByUserId = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

import { listLeaves } from "@/services/leave/list-leaves.service";
import { AuthorizationError } from "@/lib/errors";

const MOCK_RESULT = {
  items: [{ id: "L1", status: "PENDING" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByFilters.mockResolvedValue(MOCK_RESULT);
});

describe("listLeaves service", () => {
  it("returns paginated leaves for admin", async () => {
    const result = await listLeaves(
      { page: 1, limit: 20 },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        limit: 20,
        studentId: undefined,
      })
    );
  });

  it("scopes to student when current user is STUDENT", async () => {
    mockFindByUserId.mockResolvedValue({ id: "S1", userId: "U1" });

    const result = await listLeaves(
      { page: 1, limit: 20 },
      { id: "U1", roles: ["STUDENT"] }
    );

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: "S1" })
    );
  });

  it("throws AuthorizationError when student profile not found for STUDENT role", async () => {
    mockFindByUserId.mockResolvedValue(null);

    await expect(
      listLeaves({ page: 1, limit: 20 }, { id: "U1", roles: ["STUDENT"] })
    ).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("passes status filter", async () => {
    await listLeaves(
      { page: 1, limit: 20, status: "APPROVED" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ status: "APPROVED" })
    );
  });

  it("passes leaveTypeId filter", async () => {
    await listLeaves(
      { page: 1, limit: 20, leaveTypeId: "LT1" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ leaveTypeId: "LT1" })
    );
  });

  it("passes hostelId filter", async () => {
    await listLeaves(
      { page: 1, limit: 20, hostelId: "H1" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ hostelId: "H1" })
    );
  });

  it("passes search filter", async () => {
    await listLeaves(
      { page: 1, limit: 20, search: "test" },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ search: "test" })
    );
  });

  it("parses date strings to Date objects", async () => {
    const startDate = "2026-06-01";
    const endDate = "2026-06-10";

    await listLeaves(
      { page: 1, limit: 20, startDate, endDate },
      { id: "U1", roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      })
    );
  });

  it("works without currentUser", async () => {
    await listLeaves({ page: 1, limit: 10 });

    expect(mockFindByFilters).toHaveBeenCalled();
  });

  it("filters by scoped hostel ids for a HOSTEL-scoped ADMIN", async () => {
    await listLeaves(
      { page: 1, limit: 20 },
      {
        id: "U1",
        clerkId: "C1",
        email: null,
        roles: ["ADMIN"],
        roleScopes: [{ roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" }],
      }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ hostelIds: ["H1"] })
    );
  });

  it("does not filter by hostel when ADMIN has no role scopes", async () => {
    await listLeaves(
      { page: 1, limit: 20 },
      { id: "U1", clerkId: "C1", email: null, roles: ["ADMIN"] }
    );

    expect(mockFindByFilters).toHaveBeenCalledWith(
      expect.objectContaining({ hostelIds: undefined })
    );
  });
});
