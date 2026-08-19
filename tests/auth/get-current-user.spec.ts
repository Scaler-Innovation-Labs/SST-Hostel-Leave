// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockFindRoles = vi.fn();
const mockFindRoleScopes = vi.fn();
const mockFindByClerkId = vi.fn();

vi.mock("@/db/repositories/auth/user-role.repository", () => ({
  userRoleRepository: {
    findRoleCodesByUserId: (...args: any[]) => mockFindRoles(...args),
    findRoleScopesByUserId: (...args: any[]) => mockFindRoleScopes(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    findByClerkId: (...args: any[]) => mockFindByClerkId(...args),
    touchLastLogin: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth/get-current-user";

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns null when no clerk user", async () => {
    const { currentUser } = await import("@clerk/nextjs/server");
    currentUser.mockResolvedValue(null);

    const res = await getCurrentUser();
    expect(res).toBeNull();
  });

  it("loads role codes and returns current user with roles", async () => {
    const clerkUser = { id: "C1", emailAddresses: [{ emailAddress: "a@example.com" }] };
    const { currentUser } = await import("@clerk/nextjs/server");
    currentUser.mockResolvedValue(clerkUser);

    mockFindByClerkId.mockResolvedValue({ id: "U1", clerkId: "C1" });
    mockFindRoles.mockResolvedValue(["ADMIN"]);
    mockFindRoleScopes.mockResolvedValue([]);

    const res = await getCurrentUser();

    expect(res).toBeDefined();
    expect(res?.id).toEqual("U1");
    expect(res?.roles).toContain("ADMIN");
  });

  it("loads role scopes alongside role codes", async () => {
    const clerkUser = { id: "C2", emailAddresses: [{ emailAddress: "b@example.com" }] };
    const { currentUser } = await import("@clerk/nextjs/server");
    currentUser.mockResolvedValue(clerkUser);

    mockFindByClerkId.mockResolvedValue({ id: "U2", clerkId: "C2" });
    mockFindRoles.mockResolvedValue(["ADMIN"]);
    mockFindRoleScopes.mockResolvedValue([
      { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
    ]);

    const res = await getCurrentUser();

    expect(res?.roleScopes).toEqual([
      { roleCode: "ADMIN", scopeType: "HOSTEL", scopeId: "H1" },
    ]);
  });
});