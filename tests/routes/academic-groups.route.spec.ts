// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockCreateGroup = vi.fn();
const mockUpdateGroup = vi.fn();
const mockDeleteGroup = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/academics/create-academic-group.service", () => ({
  createAcademicGroup: (...args: any[]) => mockCreateGroup(...args),
}));

vi.mock("@/services/academics/update-academic-group.service", () => ({
  updateAcademicGroup: (...args: any[]) => mockUpdateGroup(...args),
}));

vi.mock("@/services/academics/delete-academic-group.service", () => ({
  deleteAcademicGroup: (...args: any[]) => mockDeleteGroup(...args),
}));

import { POST } from "@/app/api/v1/academic-groups/route";
import { PUT, DELETE } from "@/app/api/v1/academic-groups/[id]/route";

const GROUP = { id: "G1", departmentId: "D1", batchYear: 2028, name: "CSE 2028" };

const VALID_BODY = {
  departmentId: "550e8400-e29b-41d4-a716-446655440000",
  batchYear: 2028,
  name: "CSE 2028",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockCreateGroup.mockResolvedValue(GROUP);
  mockUpdateGroup.mockResolvedValue(GROUP);
  mockDeleteGroup.mockResolvedValue({ deleted: true });
});

function jsonReq(body: unknown): Request {
  return new Request("http://localhost:3000/api/v1/academic-groups", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/academic-groups", () => {
  it("creates an academic group with the authenticated actor", async () => {
    const res = await POST(jsonReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(GROUP);
    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({ batchYear: 2028, name: "CSE 2028" }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });

  it("rejects an invalid department id", async () => {
    const res = await POST(jsonReq({ ...VALID_BODY, departmentId: "not-a-uuid" }));

    expect(res.status).toBe(400);
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });
});

describe("PUT /api/v1/academic-groups/[id]", () => {
  it("updates an academic group", async () => {
    const res = await PUT(jsonReq(VALID_BODY), { params: Promise.resolve({ id: "G1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(GROUP);
    expect(mockUpdateGroup).toHaveBeenCalledWith(
      "G1",
      expect.objectContaining({ batchYear: 2028 }),
      { id: "U1", roles: ["SUPER_ADMIN"] },
    );
  });
});

describe("DELETE /api/v1/academic-groups/[id]", () => {
  it("deletes an academic group", async () => {
    const res = await DELETE(new Request("http://localhost:3000/api/v1/academic-groups/G1"), {
      params: Promise.resolve({ id: "G1" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({ deleted: true });
    expect(mockDeleteGroup).toHaveBeenCalledWith("G1", { id: "U1", roles: ["SUPER_ADMIN"] });
  });
});
