// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateUser = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/user/create-user.service", () => ({
  createUser: (...args: any[]) => mockCreateUser(...args),
}));

import { POST } from "@/app/api/v1/users/route";

const USER = { id: "U2", fullName: "New Admin", email: "admin@example.com", isActive: true };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreateUser.mockResolvedValue(USER);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/users", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/users", () => {
  it("creates a user with the authenticated actor", async () => {
    const res = await POST(jsonReq({ fullName: "New Admin", email: "admin@example.com", isActive: true, roleCodes: ["ADMIN"] }));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(USER);
    expect(mockCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: "New Admin" }),
      "U1",
    );
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(jsonReq({ email: "no-name@example.com" }));

    expect(res.status).toBe(400);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });

  it("enforces super-admin authorization", async () => {
    const { AuthorizationError } = await import("@/lib/errors");
    mockRequireAnyRole.mockImplementation(() => {
      throw new AuthorizationError();
    });

    const res = await POST(jsonReq({ fullName: "New Admin" }));

    expect(res.status).toBe(403);
    expect(mockCreateUser).not.toHaveBeenCalled();
  });
});
