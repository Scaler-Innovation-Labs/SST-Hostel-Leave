// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockList = vi.fn();
const mockGetById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/parent/parent-management.service", () => ({
  parentManagementService: {
    list: (...args: any[]) => mockList(...args),
    getById: (...args: any[]) => mockGetById(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    delete: (...args: any[]) => mockDelete(...args),
  },
}));

import { POST } from "@/app/api/v1/parents/route";
import { PUT, DELETE } from "@/app/api/v1/parents/[id]/route";

const PARENT = { id: "P1", studentId: "S1", name: "Parent One", phone: "+1234567890", relationship: "FATHER", isPrimary: true };

const VALID_BODY = {
  studentId: "550e8400-e29b-41d4-a716-446655440000",
  name: "Parent One",
  phone: "+1234567890",
  relationship: "FATHER",
  isPrimary: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreate.mockResolvedValue(PARENT);
  mockUpdate.mockResolvedValue(PARENT);
  mockDelete.mockResolvedValue(undefined);
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/parents", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/parents", () => {
  it("creates a parent with the authenticated actor", async () => {
    const res = await POST(jsonReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(PARENT);
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Parent One" }), "U1");
  });

  it("rejects an invalid student id", async () => {
    const res = await POST(jsonReq({ ...VALID_BODY, studentId: "nope" }));

    expect(res.status).toBe(400);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/parents/[id]", () => {
  it("updates a parent", async () => {
    const res = await PUT(jsonReq({ name: "Parent One Updated" }), { params: Promise.resolve({ id: "P1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(PARENT);
    expect(mockUpdate).toHaveBeenCalledWith("P1", expect.objectContaining({ name: "Parent One Updated" }), "U1");
  });
});

describe("DELETE /api/v1/parents/[id]", () => {
  it("deletes a parent", async () => {
    const res = await DELETE(new Request("http://localhost:3000/api/v1/parents/P1"), {
      params: Promise.resolve({ id: "P1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDelete).toHaveBeenCalledWith("P1", "U1");
  });
});
