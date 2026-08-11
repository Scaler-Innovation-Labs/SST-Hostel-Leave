// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListPolicies = vi.fn();
const mockCreatePolicy = vi.fn();
const mockGetPolicy = vi.fn();
const mockUpdatePolicy = vi.fn();
const mockDeletePolicy = vi.fn();

vi.mock("@/lib/db", () => ({ db: { transaction: (cb: any) => cb({}) } }));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/services/policy/manage-policy.service", () => ({
  listPolicies: (...args: any[]) => mockListPolicies(...args),
  getPolicyById: (...args: any[]) => mockGetPolicy(...args),
  createPolicy: (...args: any[]) => mockCreatePolicy(...args),
  updatePolicy: (...args: any[]) => mockUpdatePolicy(...args),
  deletePolicy: (...args: any[]) => mockDeletePolicy(...args),
}));

vi.mock("@/lib/api/response", () => ({
  ApiResponse: {
    success: vi.fn((data) => Response.json({ success: true, data }, { status: 200 })),
    created: vi.fn((data) => Response.json({ success: true, data }, { status: 201 })),
    fromError: vi.fn((err) => Response.json({ success: false, error: err.message }, { status: err.status || 500 })),
  },
}));

import { GET as GET_LIST, POST } from "@/app/api/v1/policies/route";
import { GET as GET_BY_ID, PUT, DELETE } from "@/app/api/v1/policies/[id]/route";

const MOCK_POLICIES = [{ id: "P1", name: "Max Days", policyType: "LIMIT", config: { maxDays: 5 } }];

beforeEach(() => {
  vi.clearAllMocks();
  mockListPolicies.mockResolvedValue(MOCK_POLICIES);
  mockGetPolicy.mockResolvedValue(MOCK_POLICIES[0]);
  mockCreatePolicy.mockResolvedValue(MOCK_POLICIES[0]);
  mockUpdatePolicy.mockResolvedValue(MOCK_POLICIES[0]);
  mockDeletePolicy.mockResolvedValue(undefined);
});

describe("GET /api/v1/policies", () => {
  it("returns policies list", async () => {
    const res = await GET_LIST();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual(MOCK_POLICIES);
  });
});

describe("POST /api/v1/policies", () => {
  it("creates a policy", async () => {
    const req = new Request("http://localhost:3000/api/v1/policies", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Max Days", policyType: "LIMIT", config: { maxDays: 5 } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });
});

describe("GET /api/v1/policies/[id]", () => {
  it("returns policy by id", async () => {
    const req = new Request("http://localhost:3000/api/v1/policies/P1");
    const res = await GET_BY_ID(req, { params: Promise.resolve({ id: "P1" }) });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/v1/policies/[id]", () => {
  it("updates a policy", async () => {
    const req = new Request("http://localhost:3000/api/v1/policies/P1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Updated", policyType: "LIMIT", config: {} }),
    });
    const res = await PUT(req, { params: Promise.resolve({ id: "P1" }) });
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/v1/policies/[id]", () => {
  it("deletes a policy", async () => {
    const req = new Request("http://localhost:3000/api/v1/policies/P1", { method: "DELETE" });
    const res = await DELETE(req, { params: Promise.resolve({ id: "P1" }) });
    expect(res.status).toBe(200);
  });
});
