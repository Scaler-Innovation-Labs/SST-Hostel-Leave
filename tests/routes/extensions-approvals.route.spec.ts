// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListExtensionApprovals = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/list-extension-approvals.service", () => ({
  listExtensionApprovals: (...args: any[]) => mockListExtensionApprovals(...args),
}));

import { GET } from "@/app/api/v1/extensions/approvals/route";

const MOCK_RESULT = { items: [{ id: "A1", decision: "PENDING", extension: null, leaveRequest: null }], total: 1, page: 1, limit: 20, totalPages: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  mockListExtensionApprovals.mockResolvedValue(MOCK_RESULT);
});

describe("GET /api/v1/extensions/approvals", () => {
  it("returns extension approvals", async () => {
    const req = new Request("http://localhost:3000/api/v1/extensions/approvals?page=1&limit=10");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.items).toHaveLength(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET(new Request("http://localhost:3000/api/v1/extensions/approvals"));
    expect(res.status).toBe(401);
  });
});
