// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListAuditLogs = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: { listAuditLogs: (...args: any[]) => mockListAuditLogs(...args) },
}));

import { GET } from "@/app/api/v1/audit/route";

describe("GET /api/v1/audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns audit logs for an entity", async () => {
    mockListAuditLogs.mockResolvedValue({
      items: [
        {
          id: "A1",
          entityType: "LEAVE_REQUEST",
          entityId: "LR1",
          action: "CREATE",
          actorName: "Admin User",
          createdAt: "2026-06-01T10:00:00Z",
        },
      ],
      total: 1,
    });

    const res = await GET(
      new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST&entityId=LR1"),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items[0].action).toBe("CREATE");
    expect(mockListAuditLogs).toHaveBeenLastCalledWith(
      expect.objectContaining({ entityType: "LEAVE_REQUEST", entityId: "LR1" }),
      expect.objectContaining({ id: "U1" }),
    );
  });

  it("rejects a missing entityId", async () => {
    const res = await GET(
      new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST"),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(mockListAuditLogs).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET(
      new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST&entityId=LR1"),
    );

    expect(res.status).toBe(401);
  });
});
