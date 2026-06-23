// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListUsers = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/services/user/list-users.service", () => ({
  listUsers: (...args: any[]) => mockListUsers(...args),
}));

import { GET } from "@/app/api/v1/users/route";

describe("GET /api/v1/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated users", async () => {
    const mockResult = {
      items: [{
        id: "U1",
        fullName: "Test User",
        email: "test@example.com",
        isActive: true,
        userRoles: [{ roleCode: "STUDENT", roleName: "Student" }],
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListUsers.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/users");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
  });

  it("filters by role", async () => {
    mockListUsers.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/users?role=STUDENT");
    await GET(req);

    expect(mockListUsers).toHaveBeenCalledWith(
      expect.objectContaining({ role: "STUDENT" })
    );
  });

  it("filters by isActive", async () => {
    mockListUsers.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/users?isActive=true");
    await GET(req);

    expect(mockListUsers).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true })
    );
  });

  it("returns 403 for non-super-admin role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/users");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
