// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindRoles = vi.fn();
const mockFindRoleScopes = vi.fn();
const mockFindByClerkId = vi.fn();
const mockTouchLastLogin = vi.fn();
const mockAuth = vi.fn();
const mockCurrentUser = vi.fn();

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRoleCodesByUserId: (...args: any[]) => mockFindRoles(...args),
    findRoleScopesByUserId: (...args: any[]) => mockFindRoleScopes(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByClerkId: (...args: any[]) => mockFindByClerkId(...args),
    touchLastLogin: (...args: any[]) => mockTouchLastLogin(...args),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: (...args: any[]) => mockAuth(...args),
  currentUser: (...args: any[]) => mockCurrentUser(...args),
}));

import { getCurrentUser } from "@/lib/auth/get-current-user";

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.mockResolvedValue({ userId: "C1" });
    mockCurrentUser.mockResolvedValue({ id: "C1", emailAddresses: [{ emailAddress: "a@example.com" }] });
  });

  it("returns null when no clerk user", async () => {
    mockAuth.mockResolvedValue({ userId: null });

    const res = await getCurrentUser();
    expect(res).toBeNull();
  });

  it("loads role codes and returns current user with roles", async () => {
    mockAuth.mockResolvedValue({ userId: "C1" });

    mockFindByClerkId.mockResolvedValue({
      id: "U1",
      clerkId: "C1",
      email: "a@example.com",
      isActive: true,
      deletedAt: null,
    });
    mockFindRoles.mockResolvedValue(["ADMIN"]);
    mockFindRoleScopes.mockResolvedValue([]);

    const res = await getCurrentUser();

    expect(res).toBeDefined();
    expect(res?.id).toEqual("U1");
    expect(res?.roles).toContain("ADMIN");
  });

  it("loads role scopes alongside role codes", async () => {
    mockAuth.mockResolvedValue({ userId: "C2" });

    mockFindByClerkId.mockResolvedValue({
      id: "U2",
      clerkId: "C2",
      email: "b@example.com",
      isActive: true,
      deletedAt: null,
    });
    mockFindRoles.mockResolvedValue(["ADMIN"]);
    mockFindRoleScopes.mockResolvedValue([
      { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
    ]);

    const res = await getCurrentUser();

    expect(res?.roleScopes).toEqual([
      { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
    ]);
  });

  it("does not call touchLastLogin during authentication resolution", async () => {
    mockAuth.mockResolvedValue({ userId: "C3" });

    mockFindByClerkId.mockResolvedValue({
      id: "U3",
      clerkId: "C3",
      email: "c@example.com",
      isActive: true,
      deletedAt: null,
    });
    mockFindRoles.mockResolvedValue(["STUDENT"]);
    mockFindRoleScopes.mockResolvedValue([]);

    await getCurrentUser();

    expect(mockTouchLastLogin).not.toHaveBeenCalled();
  });
});
