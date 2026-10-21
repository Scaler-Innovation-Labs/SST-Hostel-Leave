// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCurrentUser = vi.fn();
const mockFindByClerkId = vi.fn();
const mockFindByEmail = vi.fn();
const mockUpdateClerkId = vi.fn();
const mockCreate = vi.fn();
const mockTouchLastLogin = vi.fn();
const mockFindRoleCodes = vi.fn();
const mockFindRoleScopes = vi.fn();

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: (...args: any[]) => mockCurrentUser(...args),
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByClerkId: (...args: any[]) => mockFindByClerkId(...args),
    findByEmail: (...args: any[]) => mockFindByEmail(...args),
    updateClerkId: (...args: any[]) => mockUpdateClerkId(...args),
    create: (...args: any[]) => mockCreate(...args),
    touchLastLogin: (...args: any[]) => mockTouchLastLogin(...args),
  },
}));

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRoleCodesByUserId: (...args: any[]) => mockFindRoleCodes(...args),
    findRoleScopesByUserId: (...args: any[]) => mockFindRoleScopes(...args),
  },
}));

import { getCurrentUser } from "@/lib/auth/get-current-user";

const clerkUser = {
  id: "clerk_1",
  emailAddresses: [
    { emailAddress: "student@example.com", verification: { status: "verified" } },
  ],
  firstName: "Test",
  lastName: "Student",
  username: "test",
  imageUrl: "",
};

beforeEach(() => {
  vi.resetAllMocks();
  mockCurrentUser.mockResolvedValue(clerkUser);
  mockTouchLastLogin.mockResolvedValue(undefined);
  mockFindRoleCodes.mockResolvedValue(["STUDENT"]);
  mockFindRoleScopes.mockResolvedValue(["HOSTEL"]);
});

describe("getCurrentUser account status", () => {
  it("returns the user when the account is active", async () => {
    mockFindByClerkId.mockResolvedValue({
      id: "U1",
      isActive: true,
      deletedAt: null,
    });

    const result = await getCurrentUser();

    expect(result).toMatchObject({
      id: "U1",
      roles: ["STUDENT"],
      roleScopes: ["HOSTEL"],
    });
    expect(mockTouchLastLogin).toHaveBeenCalledWith("U1");
  });

  it("denies a deactivated user even with a valid Clerk session", async () => {
    mockFindByClerkId.mockResolvedValue({
      id: "U2",
      isActive: false,
      deletedAt: null,
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockFindRoleCodes).not.toHaveBeenCalled();
    expect(mockTouchLastLogin).not.toHaveBeenCalled();
  });

  it("denies a soft-deleted user", async () => {
    mockFindByClerkId.mockResolvedValue({
      id: "U3",
      isActive: true,
      deletedAt: new Date("2026-01-01"),
    });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockFindRoleCodes).not.toHaveBeenCalled();
  });
});
