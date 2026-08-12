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

  it("passes filters through to the service", async () => {
    const req = new Request(
      "http://localhost:3000/api/v1/extensions/approvals?status=PENDING&search=neerasa&waitingOn=ADMIN_APPROVAL&leaveTypeId=11111111-1111-4111-8111-111111111111&hostelId=22222222-2222-4222-8222-222222222222&dateFrom=2026-08-01T00:00:00.000Z&dateTo=2026-08-10T00:00:00.000Z&page=1&limit=20"
    );
    const res = await GET(req);
    await res.json();
    expect(res.status).toBe(200);

    expect(mockListExtensionApprovals).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "PENDING",
        search: "neerasa",
        waitingOn: "ADMIN_APPROVAL",
        leaveTypeId: "11111111-1111-4111-8111-111111111111",
        hostelId: "22222222-2222-4222-8222-222222222222",
        dateFrom: "2026-08-01T00:00:00.000Z",
        dateTo: "2026-08-10T00:00:00.000Z",
        page: 1,
        limit: 20,
      }),
      expect.anything()
    );
  });

  it("rejects a malformed hostel id", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/extensions/approvals?hostelId=not-a-uuid"));
    expect(res.status).toBe(400);
    expect(mockListExtensionApprovals).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET(new Request("http://localhost:3000/api/v1/extensions/approvals"));
    expect(res.status).toBe(401);
  });
});
