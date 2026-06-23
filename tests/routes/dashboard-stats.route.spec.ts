// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetDashboardStats = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["STUDENT"] }),
}));

vi.mock("@/services/dashboard/get-dashboard-stats.service", () => ({
  getDashboardStats: (...args: any[]) => mockGetDashboardStats(...args),
}));

import { GET } from "@/app/api/v1/dashboard/stats/route";

describe("GET /api/v1/dashboard/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns student dashboard stats", async () => {
    const mockStats = {
      pendingLeaves: 2,
      approvedLeaves: 1,
      activeLeave: { id: "LR1", leaveType: "Home Pass", startAt: "2026-06-10T00:00:00Z", endAt: "2026-06-12T00:00:00Z", status: "APPROVED" },
      currentLocation: "INSIDE_HOSTEL",
      activeQr: null,
    };
    mockGetDashboardStats.mockResolvedValue(mockStats);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.pendingLeaves).toBe(2);
    expect(body.data.currentLocation).toBe("INSIDE_HOSTEL");
  });

  it("returns staff dashboard stats for admin", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockResolvedValue({ id: "U1", roles: ["ADMIN"] });

    const mockStats = {
      pendingApprovals: 5,
      activeStudents: 100,
      studentsOutside: 12,
      overdueStudents: 3,
    };
    mockGetDashboardStats.mockResolvedValue(mockStats);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.pendingApprovals).toBe(5);
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
