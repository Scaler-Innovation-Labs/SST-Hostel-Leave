// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetLeave = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/services/leave/get-leave.service", () => ({
  getLeave: (...args: any[]) => mockGetLeave(...args),
}));

import { GET } from "@/app/api/v1/leaves/[id]/route";

describe("GET /api/v1/leaves/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns leave by id", async () => {
    const mockResult = {
      leave: { id: "LR1", status: "APPROVED" },
      student: { id: "S1" },
      user: { id: "U1", fullName: "Test" },
      leaveType: { id: "LT1", name: "Home Pass" },
    };
    mockGetLeave.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/leaves/LR1");
    const res = await GET(req, { params: Promise.resolve({ id: "LR1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.leave.id).toBe("LR1");
  });

  it("returns 404 when leave not found", async () => {
    mockGetLeave.mockRejectedValue(new (await import("@/lib/errors")).NotFoundError("LeaveRequest"));

    const req = new Request("http://localhost:3000/api/v1/leaves/NONEXISTENT");
    const res = await GET(req, { params: Promise.resolve({ id: "NONEXISTENT" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/leaves/LR1");
    const res = await GET(req, { params: Promise.resolve({ id: "LR1" }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
