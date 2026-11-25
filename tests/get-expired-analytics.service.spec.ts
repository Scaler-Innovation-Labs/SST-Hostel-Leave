// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockCountExpiredLeaves = vi.fn();
const mockCountExpiredExtensions = vi.fn();
const mockCountExpiredQrPasses = vi.fn();
const mockExpiredByLeaveType = vi.fn();
const mockExpiredByPendingStep = vi.fn();
const mockExpiredByHostel = vi.fn();
const mockExpiredByDepartment = vi.fn();
const mockExpiredTrend = vi.fn();

vi.mock("@/db/repositories/leave/leave-analytics.repository", () => ({
  leaveAnalyticsRepository: {
    countExpiredLeaves: (...args: any[]) => mockCountExpiredLeaves(...args),
    countExpiredExtensions: (...args: any[]) => mockCountExpiredExtensions(...args),
    countExpiredQrPasses: (...args: any[]) => mockCountExpiredQrPasses(...args),
    expiredByLeaveType: (...args: any[]) => mockExpiredByLeaveType(...args),
    expiredByPendingStep: (...args: any[]) => mockExpiredByPendingStep(...args),
    expiredByHostel: (...args: any[]) => mockExpiredByHostel(...args),
    expiredByDepartment: (...args: any[]) => mockExpiredByDepartment(...args),
    expiredTrend: (...args: any[]) => mockExpiredTrend(...args),
  },
}));

import { getExpiredAnalytics } from "@/services/analytics/get-expired-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountExpiredLeaves.mockResolvedValue(8);
  mockCountExpiredExtensions.mockResolvedValue(3);
  mockCountExpiredQrPasses.mockResolvedValue(5);
  mockExpiredByLeaveType.mockResolvedValue([{ name: "Home Pass", count: 8, color: null }]);
  mockExpiredByPendingStep.mockResolvedValue([
    { stepKey: "PARENT_APPROVAL", count: 6 },
    { stepKey: null, count: 2 },
  ]);
  mockExpiredByHostel.mockResolvedValue([{ name: "BH1", count: 8 }]);
  mockExpiredByDepartment.mockResolvedValue([{ name: "CSE", count: 8 }]);
  mockExpiredTrend.mockResolvedValue([]);
});

describe("getExpiredAnalytics", () => {
  it("computes totalExpired and formats pending step labels", async () => {
    const result = await getExpiredAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] }, "7d");

    expect(result.period).toBe("7d");
    expect(result.totalExpired).toBe(11);
    expect(result.expiredLeaves).toBe(8);
    expect(result.expiredExtensions).toBe(3);
    expect(result.expiredQrPasses).toBe(5);
    expect(result.byPendingStep).toEqual([
      { name: "Parent Approval", count: 6 },
      { name: "Unassigned", count: 2 },
    ]);
    expect(result.expiredTrend.length).toBeGreaterThan(0);
  });

  it("omits date bounds for 'all' period and returns raw trend", async () => {
    mockExpiredTrend.mockResolvedValue([{ date: "2026-11-20", count: 4 }]);

    const result = await getExpiredAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] }, "all");

    expect(result.period).toBe("all");
    expect(result.expiredTrend).toEqual([{ date: "2026-11-20", value: 4 }]);
    expect(mockCountExpiredLeaves).toHaveBeenCalledWith(undefined, undefined, undefined);
  });
});
