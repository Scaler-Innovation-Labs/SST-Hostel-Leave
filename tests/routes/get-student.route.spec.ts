// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetStudent = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/student/get-student.service", () => ({
  getStudent: (...args: any[]) => mockGetStudent(...args),
}));

import { GET } from "@/app/api/v1/students/[id]/route";

describe("GET /api/v1/students/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns student by id", async () => {
    const mockResult = {
      student: { id: "S1", rollNumber: "24BCS1", currentLocationState: "INSIDE_HOSTEL" },
      user: { id: "U1", fullName: "Test Student" },
      locationState: { code: "INSIDE_HOSTEL", name: "Inside Hostel" },
    };
    mockGetStudent.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/students/S1");
    const res = await GET(req, { params: Promise.resolve({ id: "S1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.student.id).toBe("S1");
  });

  it("returns 404 when student not found", async () => {
    mockGetStudent.mockRejectedValue(new (await import("@/lib/errors")).NotFoundError("Student"));

    const req = new Request("http://localhost:3000/api/v1/students/NONEXISTENT");
    const res = await GET(req, { params: Promise.resolve({ id: "NONEXISTENT" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 403 for student role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/students/S1");
    const res = await GET(req, { params: Promise.resolve({ id: "S1" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
