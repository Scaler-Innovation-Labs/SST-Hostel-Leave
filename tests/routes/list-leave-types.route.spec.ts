// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockListLeaveTypes = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/services/leave/list-leave-types.service", () => ({
  listLeaveTypes: (...args: any[]) => mockListLeaveTypes(...args),
}));

import { GET } from "@/app/api/v1/leave-types/route";

describe("GET /api/v1/leave-types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all active leave types", async () => {
    const mockTypes = [
      { id: "LT1", code: "HOME_PASS", name: "Home Pass", isActive: true },
      { id: "LT2", code: "MEDICAL", name: "Medical Leave", isActive: true },
    ];
    mockListLeaveTypes.mockResolvedValue(mockTypes);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual(mockTypes);
  });

  it("returns empty array when no types exist", async () => {
    mockListLeaveTypes.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });
});
