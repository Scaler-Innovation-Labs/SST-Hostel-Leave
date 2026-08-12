// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateDepartment = vi.fn();
const mockUpdateDepartment = vi.fn();
const mockDeleteDepartment = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/academics/create-department.service", () => ({
  createDepartment: (...args: any[]) => mockCreateDepartment(...args),
}));

vi.mock("@/services/academics/update-department.service", () => ({
  updateDepartment: (...args: any[]) => mockUpdateDepartment(...args),
}));

vi.mock("@/services/academics/delete-department.service", () => ({
  deleteDepartment: (...args: any[]) => mockDeleteDepartment(...args),
}));

import { POST } from "@/app/api/v1/departments/route";
import { PUT, DELETE } from "@/app/api/v1/departments/[id]/route";

const DEPARTMENT = { id: "D1", code: "CSE", name: "Computer Science" };

const VALID_BODY = { code: "CSE", name: "Computer Science" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreateDepartment.mockResolvedValue(DEPARTMENT);
  mockUpdateDepartment.mockResolvedValue(DEPARTMENT);
  mockDeleteDepartment.mockResolvedValue({ deleted: true });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/departments", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/departments", () => {
  it("creates a department with the authenticated actor", async () => {
    const res = await POST(jsonReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(DEPARTMENT);
    expect(mockCreateDepartment).toHaveBeenCalledWith(
      expect.objectContaining({ code: "CSE" }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });

  it("rejects a body missing required fields", async () => {
    const res = await POST(jsonReq({ name: "No Code" }));

    expect(res.status).toBe(400);
    expect(mockCreateDepartment).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/departments/[id]", () => {
  it("updates a department", async () => {
    const res = await PUT(jsonReq(VALID_BODY), { params: Promise.resolve({ id: "D1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(DEPARTMENT);
    expect(mockUpdateDepartment).toHaveBeenCalledWith(
      "D1",
      expect.objectContaining({ code: "CSE" }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });
});

describe("DELETE /api/v1/departments/[id]", () => {
  it("deletes a department", async () => {
    const res = await DELETE(new Request("http://localhost:3000/api/v1/departments/D1"), {
      params: Promise.resolve({ id: "D1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDeleteDepartment).toHaveBeenCalledWith("D1", { id: "U1", roles: ["SUPER_ADMIN"] });
  });
});
