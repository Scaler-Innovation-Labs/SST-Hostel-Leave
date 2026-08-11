// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindByLeaveRequestIdPaginated = vi.fn();
const mockVerifyStudentOwnership = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findByLeaveRequestIdPaginated: (...args: any[]) => mockFindByLeaveRequestIdPaginated(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  verifyStudentOwnership: (...args: any[]) => mockVerifyStudentOwnership(...args),
}));

import { listLeaveExtensions } from "@/services/leave/list-leave-extensions.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_RESULT = {
  items: [{ id: "EXT1", extensionNumber: 1, status: "PENDING" }],
  total: 1,
  page: 1,
  limit: 20,
  totalPages: 1,
};

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue({ id: "LR1", studentId: "S1" });
  mockFindByLeaveRequestIdPaginated.mockResolvedValue(MOCK_RESULT);
  mockVerifyStudentOwnership.mockResolvedValue(undefined);
});

describe("listLeaveExtensions service", () => {
  it("returns paginated extensions for a leave request", async () => {
    const result = await listLeaveExtensions("LR1", { page: 1, limit: 20 }, { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual(MOCK_RESULT);
    expect(mockFindById).toHaveBeenCalledWith("LR1");
    expect(mockVerifyStudentOwnership).toHaveBeenCalledWith({ id: "U1", roles: ["ADMIN"] }, "S1");
    expect(mockFindByLeaveRequestIdPaginated).toHaveBeenCalledWith("LR1", 1, 20);
  });

  it("throws NotFoundError when leave does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(listLeaveExtensions("NONEXISTENT", { page: 1, limit: 20 }, { id: "U1", roles: ["ADMIN"] }))
      .rejects.toBeInstanceOf(NotFoundError);
  });
});
