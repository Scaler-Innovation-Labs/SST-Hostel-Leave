// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListLeaves = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: vi.fn().mockResolvedValue({ id: "S1", userId: "U1" }),
  },
}));

vi.mock("@/services/leave/list-leaves.service", () => ({
  listLeaves: (...args: any[]) => mockListLeaves(...args),
}));

import { GET } from "@/app/api/v1/leaves/route";

describe("GET /api/v1/leaves", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated leaves", async () => {
    const mockResult = {
      items: [{ leave: { id: "LR1" }, student: null, user: null, leaveType: null }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListLeaves.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/leaves");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockResult);
  });

  it("applies query filters", async () => {
    mockListLeaves.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/leaves?status=PENDING&page=1&limit=10");
    await GET(req);

    expect(mockListLeaves).toHaveBeenCalledWith(
      expect.objectContaining({ status: "PENDING", page: 1, limit: 10 })
    );
  });

  it("returns 400 for invalid query params", async () => {
    const req = new Request("http://localhost:3000/api/v1/leaves?page=-1");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const req = new Request("http://localhost:3000/api/v1/leaves");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
