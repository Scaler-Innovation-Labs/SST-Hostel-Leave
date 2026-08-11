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

vi.mock("@/services/academics/list-academic-groups.service", () => ({
  listAcademicGroups: (...args: any[]) => mockList(...args),
}));

vi.mock("@/services/academics/get-academic-group.service", () => ({
  getAcademicGroupById: (...args: any[]) => mockGetById(...args),
}));

vi.mock("@/services/academics/create-academic-group.service", () => ({
  createAcademicGroup: (...args: any[]) => mockCreate(...args),
}));

vi.mock("@/services/academics/update-academic-group.service", () => ({
  updateAcademicGroup: (...args: any[]) => mockUpdate(...args),
}));

vi.mock("@/services/academics/delete-academic-group.service", () => ({
  deleteAcademicGroup: (...args: any[]) => mockDelete(...args),
}));

import { GET as GET_LIST, POST } from "@/app/api/v1/academic-groups/route";
import { GET as GET_BY_ID, PUT, DELETE } from "@/app/api/v1/academic-groups/[id]/route";

const MOCK_GROUPS = [{ id: "G1", name: "2024 Batch", batchYear: 2024, departmentId: "550e8400-e29b-41d4-a716-446655440000", isActive: true }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockList.mockResolvedValue(MOCK_GROUPS);
  mockGetById.mockResolvedValue(MOCK_GROUPS[0]);
  mockCreate.mockResolvedValue(MOCK_GROUPS[0]);
  mockUpdate.mockResolvedValue(MOCK_GROUPS[0]);
  mockDelete.mockResolvedValue(undefined);
});

describe("GET /api/v1/academic-groups", () => {
  it("returns list of academic groups", async () => {
    const res = await GET_LIST();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_GROUPS);
  });
});

describe("POST /api/v1/academic-groups", () => {
  it("creates an academic group", async () => {
    const req = new Request("http://localhost:3000/api/v1/academic-groups", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "2024 Batch", batchYear: 2024, departmentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe("GET /api/v1/academic-groups/[id]", () => {
  it("returns group by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/academic-groups/G1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "G1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe("G1");
  });

  it("returns 404 when not found", async () => {
    mockGetById.mockResolvedValue(null);

    const req = new Request("http://localhost:3000/api/v1/academic-groups/NONEXISTENT");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "NONEXISTENT" }) });
    expect(res.status).toBe(404);
  });
});

describe("PUT /api/v1/academic-groups/[id]", () => {
  it("updates a group", async () => {
    const req = new Request("http://localhost:3000/api/v1/academic-groups/G1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "2025 Batch", batchYear: 2025, departmentId: "550e8400-e29b-41d4-a716-446655440000" }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "G1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/academic-groups/[id]", () => {
  it("deletes a group", async () => {
    const req = new Request("http://localhost:3000/api/v1/academic-groups/G1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "G1" }) });
    expect(res.status).toBe(200);
  });
});
