// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListApprovals = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/approval/list-approvals.service", () => ({
  listApprovals: (...args: any[]) => mockListApprovals(...args),
}));

import { GET } from "@/app/api/v1/approvals/route";

describe("GET /api/v1/approvals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated approvals", async () => {
    const mockResult = {
      items: [{
        id: "LA1",
        decision: "PENDING",
        approverRoleCode: "ADMIN",
        leaveRequest: { id: "LR1", status: "PENDING" },
        studentName: "Test Student",
        studentRollNumber: "24BCS1",
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListApprovals.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/approvals");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("filters by status", async () => {
    mockListApprovals.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/approvals?status=PENDING");
    await GET(req);

    expect(mockListApprovals).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING" }),
      expect.anything()
    );
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/approvals");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it("returns 403 when not authorized role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/approvals");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
