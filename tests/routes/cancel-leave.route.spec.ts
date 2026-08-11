// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCancelLeave = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
const mockRequireRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireRole: (...args: any[]) => mockRequireRole(...args),
}));

vi.mock("@/services/leave/cancel-leave.service", () => ({
  cancelLeave: (...args: any[]) => mockCancelLeave(...args),
}));

import { POST } from "@/app/api/v1/leaves/[id]/cancel/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });
  mockRequireRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockCancelLeave.mockResolvedValue({ leaveId: "L1", newStatus: "CANCELLED", qrInvalidated: false });
});

describe("POST /api/v1/leaves/[id]/cancel", () => {
  it("cancels a leave", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves/L1/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: "Changed plans" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.newStatus).toBe("CANCELLED");
    expect(mockCancelLeave).toHaveBeenCalled();
  });

  it("works with empty body", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves/L1/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    expect(res.status).toBe(200);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/leaves/L1/cancel", { method: "POST" });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    expect(res.status).toBe(401);
  });
});
