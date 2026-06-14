// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListStudents = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/student/list-students.service", () => ({
  listStudents: (...args: any[]) => mockListStudents(...args),
}));

import { GET } from "@/app/api/v1/students/route";

describe("GET /api/v1/students", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated students", async () => {
    const mockResult = {
      items: [{
        student: { id: "S1", rollNumber: "24BCS1", currentLocationState: "INSIDE_HOSTEL" },
        user: { id: "U1", fullName: "Test Student" },
        locationState: null,
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListStudents.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/students");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("filters by location state", async () => {
    mockListStudents.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/students?locationState=OUTSIDE_HOSTEL");
    await GET(req);

    expect(mockListStudents).toHaveBeenCalledWith(
      expect.objectContaining({ locationState: "OUTSIDE_HOSTEL" })
    );
  });

  it("returns 403 for student role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/students");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
