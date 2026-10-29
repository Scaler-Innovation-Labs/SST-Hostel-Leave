// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const mockAuth = vi.fn();
const mockRevokeSession = vi.fn();
const mockGetCurrentUser = vi.fn();
const mockTouchLastLogin = vi.fn();
const mockRedirect = vi.fn();

const mockClerkClientInstance = {
  sessions: {
    revokeSession: (...args: any[]) => mockRevokeSession(...args),
  },
};

vi.mock("@clerk/nextjs/server", () => ({
  auth: () => mockAuth(),
  clerkClient: () => Promise.resolve(mockClerkClientInstance),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`REDIRECT:${url}`);
  },
}));

vi.mock("@/lib/auth/get-current-user", () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    touchLastLogin: (...args: any[]) => mockTouchLastLogin(...args),
  },
}));

import RedirectPage from "@/app/(auth)/redirect/page";

describe("RedirectPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("redirects to /login when no session or user id", async () => {
    mockAuth.mockResolvedValue({ sessionId: null, userId: null });

    await expect(RedirectPage()).rejects.toThrow("REDIRECT:/login");
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("revokes session and redirects to /login?error=unauthorized when user not found in DB", async () => {
    mockAuth.mockResolvedValue({ sessionId: "sess_123", userId: "user_123" });
    mockGetCurrentUser.mockResolvedValue(null);

    await expect(RedirectPage()).rejects.toThrow("REDIRECT:/login?error=unauthorized");
    expect(mockRevokeSession).toHaveBeenCalledWith("sess_123");
    expect(mockTouchLastLogin).not.toHaveBeenCalled();
  });

  it("redirects to /unauthorized when user has no roles", async () => {
    mockAuth.mockResolvedValue({ sessionId: "sess_123", userId: "user_123" });
    mockGetCurrentUser.mockResolvedValue({ id: "U1", roles: [] });

    await expect(RedirectPage()).rejects.toThrow("REDIRECT:/unauthorized");
    expect(mockTouchLastLogin).not.toHaveBeenCalled();
  });

  it("records lastLoginAt and redirects to student dashboard for student role", async () => {
    mockAuth.mockResolvedValue({ sessionId: "sess_123", userId: "user_123" });
    mockGetCurrentUser.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
    mockTouchLastLogin.mockResolvedValue(undefined);

    await expect(RedirectPage()).rejects.toThrow("REDIRECT:/student/dashboard");
    expect(mockTouchLastLogin).toHaveBeenCalledWith("U1");
  });

  it("records lastLoginAt and redirects to guard scanner for guard role", async () => {
    mockAuth.mockResolvedValue({ sessionId: "sess_123", userId: "user_123" });
    mockGetCurrentUser.mockResolvedValue({ id: "U2", roles: ["GUARD"] });
    mockTouchLastLogin.mockResolvedValue(undefined);

    await expect(RedirectPage()).rejects.toThrow("REDIRECT:/guard/scanner");
    expect(mockTouchLastLogin).toHaveBeenCalledWith("U2");
  });
});
