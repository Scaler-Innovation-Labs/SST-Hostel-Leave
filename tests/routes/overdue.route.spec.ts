// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListOverdueReturns = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/movement/list-overdue-returns.service", () => ({
  listOverdueReturns: (...args: any[]) => mockListOverdueReturns(...args),
}));

import { GET } from "@/app/api/v1/overdue/route";

const FAKE_ROWS = [{ id: "Q1", studentName: "X" }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  mockListOverdueReturns.mockResolvedValue(FAKE_ROWS);
});

describe("GET /api/v1/overdue", () => {
  it("returns the overdue list as an array under data", async () => {
    const res = await GET(new Request("http://localhost:3000/api/v1/overdue"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it("requires a POC, ADMIN, or SUPER_ADMIN role", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await GET(new Request("http://localhost:3000/api/v1/overdue"));
    expect(res.status).toBe(403);
    expect(mockListOverdueReturns).not.toHaveBeenCalled();
  });

  it("returns 500 error body when the service throws", async () => {
    mockListOverdueReturns.mockRejectedValue(new Error("boom"));

    const res = await GET(new Request("http://localhost:3000/api/v1/overdue"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toBeDefined();
  });
});
