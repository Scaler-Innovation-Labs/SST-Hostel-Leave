// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockCountAll = vi.fn();
const mockStatusBreakdown = vi.fn();
const mockTrendByStatus = vi.fn();
const mockCountByLeaveType = vi.fn();
const mockCountByHostel = vi.fn();
const mockCountByDepartment = vi.fn();
const mockDurationDistribution = vi.fn();
const mockCountByDateRange = vi.fn();
const mockApprovalTimeTrend = vi.fn();
const mockAverageApprovalTime = vi.fn();

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    countAll: (...args: any[]) => mockCountAll(...args),
    countByLeaveType: (...args: any[]) => mockCountByLeaveType(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRange(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-analytics.repository", () => ({
  leaveAnalyticsRepository: {
    statusBreakdown: (...args: any[]) => mockStatusBreakdown(...args),
    trendByStatus: (...args: any[]) => mockTrendByStatus(...args),
    countByHostel: (...args: any[]) => mockCountByHostel(...args),
    countByDepartment: (...args: any[]) => mockCountByDepartment(...args),
    durationDistribution: (...args: any[]) => mockDurationDistribution(...args),
    approvalTimeTrend: (...args: any[]) => mockApprovalTimeTrend(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval-analytics.repository", () => ({
  leaveApprovalAnalyticsRepository: {
    averageApprovalTime: (...args: any[]) => mockAverageApprovalTime(...args),
  },
}));

import { getLeaveAnalytics } from "@/services/analytics/get-leave-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountAll.mockResolvedValue(10);
  mockStatusBreakdown.mockResolvedValue([
    { status: "PENDING", count: 3 },
    { status: "APPROVED", count: 5 },
  ]);
  mockTrendByStatus.mockResolvedValue([]);
  mockCountByLeaveType.mockResolvedValue([{ leaveType: "HOME_PASS", count: 4 }]);
  mockCountByHostel.mockResolvedValue([{ hostel: "BH1", count: 6 }]);
  mockCountByDepartment.mockResolvedValue([{ name: "CSE", count: 2 }]);
  mockDurationDistribution.mockResolvedValue([{ bucket: "1-2 days", count: 3 }]);
  mockCountByDateRange.mockResolvedValue([]);
  mockApprovalTimeTrend.mockResolvedValue([]);
  mockAverageApprovalTime.mockResolvedValue(4.5);
});

describe("getLeaveAnalytics", () => {
  it("maps status counts into top-level fields", async () => {
    const result = await getLeaveAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.totalLeaves).toBe(10);
    expect(result.pending).toBe(3);
    expect(result.approved).toBe(5);
    expect(result.rejected).toBe(0);
  });

  it("normalizes null department names to Unassigned", async () => {
    mockCountByDepartment.mockResolvedValue([{ name: null, count: 1 }]);

    const result = await getLeaveAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.byDepartment).toEqual([{ name: "Unassigned", count: 1 }]);
  });

  it("defaults to 30d bounded period and fills the trend range", async () => {
    const result = await getLeaveAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.period).toBe("30d");
    expect(Array.isArray(result.leaveTrend)).toBe(true);
    expect(result.leaveTrend.length).toBeGreaterThan(20);
  });

  it("returns unbounded trend for 'all' period without date filling", async () => {
    mockCountByDateRange.mockResolvedValue([{ date: "2026-01-01", count: 2 }]);

    const result = await getLeaveAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] }, "all");

    expect(result.period).toBe("all");
    expect(result.leaveTrend).toEqual([{ date: "2026-01-01", value: 2 }]);
  });
});
