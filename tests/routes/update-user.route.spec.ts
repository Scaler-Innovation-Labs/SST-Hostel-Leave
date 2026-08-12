// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockUpdateUser = vi.fn();
const mockDeactivateUser = vi.fn();
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

vi.mock("@/services/user/update-user.service", () => ({
  updateUser: (...args: any[]) => mockUpdateUser(...args),
}));

vi.mock("@/services/user/deactivate-user.service", () => ({
  deactivateUser: (...args: any[]) => mockDeactivateUser(...args),
}));

vi.mock("@/services/user/get-user.service", () => ({
  getUser: (...args: any[]) => mockGetUser(...args),
}));

import { DELETE, PATCH } from "@/app/api/v1/users/[id]/route";

const UPDATED_USER = {
  id: "U1",
  fullName: "Test User",
  email: "test@example.com",
  isActive: true,
  userRoles: [{ roleCode: "ADMIN", roleName: "Admin" }],
};

function patchReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/users/U1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/v1/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates a user profile and roles", async () => {
    mockUpdateUser.mockResolvedValue(UPDATED_USER);

    const res = await PATCH(
      patchReq({ fullName: "Test User", roleCodes: ["ADMIN"] }),
      { params: Promise.resolve({ id: "U1" }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.id).toBe("U1");
    expect(mockUpdateUser).toHaveBeenCalledWith(
      "U1",
      expect.objectContaining({ fullName: "Test User", roleCodes: ["ADMIN"] }),
      "U1",
    );
  });

  it("returns 400 for invalid body", async () => {
    const res = await PATCH(
      patchReq({ email: "not-an-email" }),
      { params: Promise.resolve({ id: "U1" }) },
    );

    expect(res.status).toBe(400);
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("returns 404 when user does not exist", async () => {
    const { NotFoundError } = await import("@/lib/errors");
    mockUpdateUser.mockRejectedValue(new NotFoundError("User"));

    const res = await PATCH(
      patchReq({ roleCodes: ["ADMIN"] }),
      { params: Promise.resolve({ id: "U9" }) },
    );

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/v1/users/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deactivates the user", async () => {
    mockDeactivateUser.mockResolvedValue({ id: "U1", isActive: false });

    const res = await DELETE(new Request("http://localhost:3000/api/v1/users/U1"), {
      params: Promise.resolve({ id: "U1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockDeactivateUser).toHaveBeenCalledWith("U1", "U1");
  });

  it("returns 404 when user does not exist", async () => {
    const { NotFoundError } = await import("@/lib/errors");
    mockDeactivateUser.mockRejectedValue(new NotFoundError("User"));

    const res = await DELETE(new Request("http://localhost:3000/api/v1/users/U9"), {
      params: Promise.resolve({ id: "U9" }),
    });

    expect(res.status).toBe(404);
  });
});
