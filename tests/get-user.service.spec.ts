// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockFindByIdWithRoles = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByIdWithRoles: (...args: any[]) => mockFindByIdWithRoles(...args),
  },
}));

import { getUser } from "@/services/user/get-user.service";
import { NotFoundError } from "@/lib/errors";

const MOCK_USER = { id: "U1", fullName: "Test User", email: "test@example.com", isActive: true, userRoles: [{ roleCode: "STUDENT", roleName: "Student" }] };

beforeEach(() => {
  vi.resetAllMocks();
  mockFindByIdWithRoles.mockResolvedValue(MOCK_USER);
});

describe("getUser service", () => {
  it("returns user by id with roles", async () => {
    const result = await getUser("U1");

    expect(result).toEqual(MOCK_USER);
    expect(mockFindByIdWithRoles).toHaveBeenCalledWith("U1");
  });

  it("throws NotFoundError when user does not exist", async () => {
    mockFindByIdWithRoles.mockResolvedValue(null);

    await expect(getUser("NONEXISTENT")).rejects.toBeInstanceOf(NotFoundError);
  });
});
