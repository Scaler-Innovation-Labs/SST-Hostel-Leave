// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockApproveLeave = vi.fn();
const mockRejectLeave = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] });
const mockRequireRole = vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
  requireRole: (...args: any[]) => mockRequireRole(...args),
}));

vi.mock("@/services/leave/approve-leave.service", () => ({
  approveLeave: (...args: any[]) => mockApproveLeave(...args),
}));

vi.mock("@/services/leave/reject-leave.service", () => ({
  rejectLeave: (...args: any[]) => mockRejectLeave(...args),
}));

import { POST } from "@/app/api/v1/leaves/[id]/approve/route";

const APPROVE_BODY = { decision: "APPROVED", comments: "Approved" };
const REJECT_BODY = { decision: "REJECTED", comments: "Rejected" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["ADMIN"] });
  mockRequireRole.mockReturnValue({ id: "U1", roles: ["STUDENT"] });
  mockApproveLeave.mockResolvedValue({ leaveId: "L1", decision: "APPROVED", stepKey: null, stepOrder: null, newStatus: "APPROVED" });
  mockRejectLeave.mockResolvedValue({ leaveId: "L1", decision: "REJECTED", stepKey: null, stepOrder: null, newStatus: "REJECTED" });
});

describe("POST /api/v1/leaves/[id]/approve", () => {
  it("approves a leave", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves/L1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(APPROVE_BODY),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.decision).toBe("APPROVED");
    expect(mockApproveLeave).toHaveBeenCalled();
  });

  it("rejects a leave", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves/L1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(REJECT_BODY),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.decision).toBe("REJECTED");
    expect(mockRejectLeave).toHaveBeenCalled();
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves/L1/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/leaves/L1/approve", {
      method: "POST",
      body: JSON.stringify(APPROVE_BODY),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "L1" }) });
    expect(res.status).toBe(401);
  });
});
