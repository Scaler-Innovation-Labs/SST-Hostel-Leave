// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockOverride = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/superadmin-override.service", () => ({
  superadminOverrideLeave: (...args: any[]) => mockOverride(...args),
}));

import { POST } from "@/app/api/v1/admin/leaves/[id]/override/route";

const RESULT = { leaveId: "L1", mode: "ALL", approvalsOverridden: 2, newStatus: "APPROVED", stepKey: null, stepOrder: null };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockOverride.mockResolvedValue(RESULT);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/admin/leaves/L1/override", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/admin/leaves/[id]/override", () => {
  it("overrides a leave as super-admin", async () => {
    const res = await POST(jsonReq({ mode: "ALL", comments: "Approving manually" }), {
      params: Promise.resolve({ id: "L1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(RESULT);
    expect(mockOverride).toHaveBeenCalledWith(
      "L1",
      "ALL",
      { id: "U1", roles: ["SUPER_ADMIN"] },
      "Approving manually"
    );
  });

  it("rejects an ADMIN caller", async () => {
    mockRequireAnyRole.mockImplementation(() => {
      throw new Error("FORBIDDEN");
    });

    const res = await POST(jsonReq({ mode: "ALL" }), {
      params: Promise.resolve({ id: "L1" }),
    });

    expect(res.status).toBe(500);
    expect(mockOverride).not.toHaveBeenCalled();
  });

  it("rejects an invalid mode", async () => {
    const res = await POST(jsonReq({ mode: "SOMETIMES" }), {
      params: Promise.resolve({ id: "L1" }),
    });

    expect(res.status).toBe(400);
    expect(mockOverride).not.toHaveBeenCalled();
  });
});
