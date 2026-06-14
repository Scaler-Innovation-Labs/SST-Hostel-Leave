// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/services/user/get-user.service", () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
}));

import { GET } from "@/app/api/v1/users/[id]/route";

describe("GET /api/v1/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns user by id", async () => {
    const mockResult = {
      id: "U1",
      fullName: "Test User",
      email: "test@example.com",
      isActive: true,
      userRoles: [{ roleCode: "STUDENT", roleName: "Student" }],
    };
    mockGetUser.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/users/U1");
    const res = await GET(req, { params: Promise.resolve({ id: "U1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("U1");
  });

  it("returns 404 for non-existent user", async () => {
    const { NotFoundError } = await import("@/lib/errors");
    mockGetUser.mockRejectedValue(new NotFoundError("User"));

    const req = new Request("http://localhost:3000/api/v1/users/nonexistent");
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent" }) });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
  });

  it("returns 403 for non-super-admin", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/users/U1");
    const res = await GET(req, { params: Promise.resolve({ id: "U1" }) });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
