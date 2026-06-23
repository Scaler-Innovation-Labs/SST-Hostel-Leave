// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListWorkflows = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/lib/auth/authorization", () => ({
  requireAnyRole: vi.fn().mockReturnValue({ id: "U1", roles: ["SUPER_ADMIN"] }),
}));

vi.mock("@/services/workflow/list-workflows.service", () => ({
  listWorkflows: (...args: any[]) => mockListWorkflows(...args),
}));

import { GET } from "@/app/api/v1/workflows/route";

describe("GET /api/v1/workflows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns paginated workflow definitions", async () => {
    const mockResult = {
      items: [{
        id: "W1",
        code: "STANDARD_LEAVE",
        name: "Standard Leave Workflow",
        isActive: true,
        version: 1,
        steps: [{
          id: "S1",
          stepKey: "parent_approval",
          stepOrder: 1,
          isParentApproval: true,
          isRequired: true,
          approverRoleName: null,
        }],
      }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    };
    mockListWorkflows.mockResolvedValue(mockResult);

    const req = new Request("http://localhost:3000/api/v1/workflows");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].steps).toHaveLength(1);
  });

  it("filters by isActive", async () => {
    mockListWorkflows.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20, totalPages: 0 });

    const req = new Request("http://localhost:3000/api/v1/workflows?isActive=true");
    await GET(req);

    expect(mockListWorkflows).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: true })
    );
  });

  it("returns 403 for student role", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["STUDENT"] });

    const { requireAnyRole } = await import("@/lib/auth/authorization");
    const { AuthorizationError } = await import("@/lib/errors");
    requireAnyRole.mockImplementation(() => { throw new AuthorizationError(); });

    const req = new Request("http://localhost:3000/api/v1/workflows");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
  });
});
