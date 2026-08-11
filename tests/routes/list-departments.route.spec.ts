// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListDepartments = vi.fn();
const mockCreateDepartment = vi.fn();
const mockRequireAuth = vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
const mockRequireAnyRole = vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: (...args: any[]) => mockRequireAnyRole(...args),
}));

vi.mock("@/services/academics/list-departments.service", () => ({
  listDepartments: (...args: any[]) => mockListDepartments(...args),
}));

vi.mock("@/services/academics/create-department.service", () => ({
  createDepartment: (...args: any[]) => mockCreateDepartment(...args),
}));

import { GET, POST } from "@/app/api/v1/departments/route";

const MOCK_DEPARTMENTS = [{ id: "D1", name: "Computer Science", code: "CS" }];

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAuth.mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockRequireAnyRole.mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] });
  mockListDepartments.mockResolvedValue(MOCK_DEPARTMENTS);
  mockCreateDepartment.mockResolvedValue(MOCK_DEPARTMENTS[0]);
});

describe("GET /api/v1/departments", () => {
  it("returns list of departments", async () => {
    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_DEPARTMENTS);
  });

  it("returns 401 when not authenticated", async () => {
    mockRequireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET();
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/departments", () => {
  it("creates a department", async () => {
    const req = new Request("http://localhost:3000/api/v1/departments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Computer Science", code: "CS" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid body", async () => {
    const req = new Request("http://localhost:3000/api/v1/departments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
