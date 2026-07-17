// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListMovements = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/movement/list-movements.service", () => ({
  listMovements: (...args: any[]) => mockListMovements(...args),
}));

import { GET } from "@/app/api/v1/movements/route";

describe("GET /api/v1/movements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated movements", async () => {
    const mockResult = {
      items: [{
        id: "ME1",
        eventType: "EXIT_HOSTEL",
        studentName: "Test Student",
        studentRollNumber: "24BCS1",
        fromStateName: "INSIDE_HOSTEL",
        toStateName: "OUTSIDE_HOSTEL",
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListMovements.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/movements");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("filters by event type", async () => {
    mockListMovements.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/movements?eventType=EXIT_HOSTEL");
    await GET(req);

    expect(mockListMovements).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "EXIT_HOSTEL" }),
      expect.anything()
    );
  });

  it("returns 403 for unauthorized role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/movements");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
