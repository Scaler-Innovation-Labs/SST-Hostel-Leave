// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockFindLeaveById = vi.fn();
const mockVerifyStudentOwnership = vi.fn();

vi.mock("@/db/repositories/leave/leave-extension.repository", () => ({
  leaveExtensionRepository: {
    findById: (...args: any[]) => mockFindById(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findById: (...args: any[]) => mockFindLeaveById(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  verifyStudentOwnership: (...args: any[]) => mockVerifyStudentOwnership(...args),
  assertCanAccessLeave: (...args: any[]) => mockVerifyStudentOwnership(...args),
}));

import { getExtension } from "@/services/leave/get-extension.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_EXTENSION = { id: "EXT1", leaveRequestId: "LR1", extensionNumber: 1, status: "PENDING", reason: "Need more time" };
const MOCK_LEAVE = { id: "LR1", studentId: "S1" };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindById.mockResolvedValue(MOCK_EXTENSION);
  mockFindLeaveById.mockResolvedValue(MOCK_LEAVE);
  mockVerifyStudentOwnership.mockResolvedValue(undefined);
});

describe("getExtension service", () => {
  it("returns extension with leave details", async () => {
    const result = await getExtension("EXT1", { id: "U1", roles: ["ADMIN"] });

    expect(result).toEqual({ ...MOCK_EXTENSION, leave: MOCK_LEAVE });
    expect(mockFindById).toHaveBeenCalledWith("EXT1");
    expect(mockFindLeaveById).toHaveBeenCalledWith("LR1");
    expect(mockVerifyStudentOwnership).toHaveBeenCalledWith({ id: "U1", roles: ["ADMIN"] }, { id: "LR1", studentId: "S1" });
  });

  it("returns extension with null leave when leave not found", async () => {
    mockFindLeaveById.mockResolvedValue(null);

    const result = await getExtension("EXT1", { id: "U1", roles: ["ADMIN"] });

    expect(result.leave).toBeNull();
    expect(mockVerifyStudentOwnership).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when extension does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(getExtension("NONEXISTENT", { id: "U1", roles: ["ADMIN"] })).rejects.toBeInstanceOf(NotFoundError);
  });
});
