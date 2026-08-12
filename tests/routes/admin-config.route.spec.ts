// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetConfigStatus = vi.fn();
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/admin/config-status.service", () => ({
  getConfigStatus: (...args: any[]) => mockGetConfigStatus(...args),
}));

import { GET } from "@/app/api/v1/admin/config/route";

describe("GET /api/v1/admin/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  });

  it("returns the config status", async () => {
    mockGetConfigStatus.mockReturnValue({
      email: { configured: true, apiKey: true, fromEmail: true },
      sms: { configured: true, apiKey: true, senderId: true },
      slack: { configured: false, botToken: false, channelId: false },
      system: { baseUrl: true, appUrl: true, authSecret: true },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email.configured).toBe(true);
    expect(body.data.slack.configured).toBe(false);
  });

  it("denies non-super-admin roles", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await GET();

    expect(res.status).toBe(403);
    expect(mockGetConfigStatus).not.toHaveBeenCalled();
  });
});
