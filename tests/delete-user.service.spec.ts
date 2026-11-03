// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindById = vi.fn();
const mockDeleteById = vi.fn();
const mockFindByUserId = vi.fn();
const mockDeleteByUserId = vi.fn();
const mockRecord = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findById: (...args: any[]) => mockFindById(...args),
    deleteById: (...args: any[]) => mockDeleteById(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    deleteByUserId: (...args: any[]) => mockDeleteByUserId(...args),
  },
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    record: (...args: any[]) => mockRecord(...args),
  },
}));

vi.mock("@/lib/db", () => ({ db: {} }));

import { deleteUser } from "@/services/user/delete-user.service";
import { NotFoundError, ValidationError } from "@/lib/errors";

const MOCK_USER = { id: "U1", fullName: "Test User", email: "test@example.com" };

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deleteUser service", () => {
  it("deletes a user when user exists and has no student record", async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    mockFindByUserId.mockResolvedValue(null);
    mockDeleteByUserId.mockResolvedValue(undefined);
    mockDeleteById.mockResolvedValue(undefined);
    mockRecord.mockResolvedValue(undefined);

    const result = await deleteUser("U1", "ACTOR_1");

    expect(result).toEqual({ id: "U1" });
    expect(mockDeleteByUserId).toHaveBeenCalledWith("U1", expect.any(Object));
    expect(mockDeleteById).toHaveBeenCalledWith("U1", expect.any(Object));
    expect(mockRecord).toHaveBeenCalled();
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockFindById.mockResolvedValue(null);

    await expect(deleteUser("NONEXISTENT", "ACTOR_1")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws ValidationError when user tries to delete their own account", async () => {
    mockFindById.mockResolvedValue(MOCK_USER);

    await expect(deleteUser("U1", "U1")).rejects.toBeInstanceOf(ValidationError);
  });

  it("throws ValidationError when user has a linked student record", async () => {
    mockFindById.mockResolvedValue(MOCK_USER);
    mockFindByUserId.mockResolvedValue({ id: "S1" });

    await expect(deleteUser("U1", "ACTOR_1")).rejects.toBeInstanceOf(ValidationError);
  });
});
