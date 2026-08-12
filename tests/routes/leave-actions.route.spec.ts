// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCompleteLeave = vi.fn();
const mockExpireLeave = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/leave/complete-leave.service", () => ({
  completeLeave: (...args: any[]) => mockCompleteLeave(...args),
}));

vi.mock("@/services/leave/expire-leave.service", () => ({
  expireSingleLeave: (...args: any[]) => mockExpireLeave(...args),
}));

import { POST as COMPLETE } from "@/app/api/v1/leaves/[id]/complete/route";
import { POST as EXPIRE } from "@/app/api/v1/leaves/[id]/expire/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  mockCompleteLeave.mockResolvedValue({ id: "L1", status: "COMPLETED" });
  mockExpireLeave.mockResolvedValue({ id: "L1", status: "EXPIRED" });
});

function jsonReq(body: unknown, url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/leaves/[id]/complete", () => {
  it("completes a leave", async () => {
    const res = await COMPLETE(jsonReq({ actualReturnAt: "2026-08-01T10:00:00.000Z" }, "http://localhost:3000/api/v1/leaves/L1/complete"), {
      params: Promise.resolve({ id: "L1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "L1", status: "COMPLETED" });
    expect(mockCompleteLeave).toHaveBeenCalledWith(
      "L1",
      expect.objectContaining({ actualReturnAt: "2026-08-01T10:00:00.000Z" }),
      { id: "U1", roles: ["ADMIN"] },
    );
  });

  it("rejects an invalid actualReturnAt", async () => {
    const res = await COMPLETE(jsonReq({ actualReturnAt: "not-a-date" }, "http://localhost:3000/api/v1/leaves/L1/complete"), {
      params: Promise.resolve({ id: "L1" }),
    });

    expect(res.status).toBe(400);
    expect(mockCompleteLeave).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/leaves/[id]/expire", () => {
  it("expires a leave", async () => {
    const res = await EXPIRE(new Request("http://localhost:3000/api/v1/leaves/L1/expire", { method: "POST" }), {
      params: Promise.resolve({ id: "L1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ id: "L1", status: "EXPIRED" });
    expect(mockExpireLeave).toHaveBeenCalledWith("L1", { id: "U1", roles: ["ADMIN"] });
  });
});
