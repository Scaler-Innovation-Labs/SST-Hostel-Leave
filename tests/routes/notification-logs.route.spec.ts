// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListNotificationLogs = vi.fn();
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/notification/list-notification-logs.service", () => ({
  listNotificationLogs: (...args: any[]) => mockListNotificationLogs(...args),
}));

import { GET } from "@/app/api/v1/admin/notification-logs/route";

describe("GET /api/v1/admin/notification-logs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  });

  it("returns paginated notification logs", async () => {
    mockListNotificationLogs.mockResolvedValue({
      items: [
        {
          id: "NL1",
          eventKey: "LEAVE_APPROVED",
          channel: "EMAIL",
          status: "SENT",
          recipient: "student@example.com",
          createdAt: "2026-06-01T10:00:00Z",
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });

    const res = await GET(
      new Request("http://localhost/api/v1/admin/notification-logs?channel=EMAIL"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items[0].channel).toBe("EMAIL");
    expect(mockListNotificationLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ channel: "EMAIL" }),
    );
  });

  it("forwards eventType and pagination params", async () => {
    mockListNotificationLogs.mockResolvedValue({ items: [], total: 0, page: 2, limit: 10 });

    await GET(
      new Request("http://localhost/api/v1/admin/notification-logs?eventType=LEAVE_APPROVED&page=2&limit=10"),
    );

    expect(mockListNotificationLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ eventType: "LEAVE_APPROVED", page: 2, limit: 10 }),
    );
  });

  it("denies non-admin roles", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await GET(new Request("http://localhost/api/v1/admin/notification-logs"));

    expect(res.status).toBe(403);
    expect(mockListNotificationLogs).not.toHaveBeenCalled();
  });
});
