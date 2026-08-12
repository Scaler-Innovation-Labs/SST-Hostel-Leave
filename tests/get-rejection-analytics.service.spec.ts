// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockCountBySource = vi.fn();
const mockTrendByDateRange = vi.fn();
const mockRejectionsByStepKey = vi.fn();
const mockRejectionsByCategory = vi.fn();
const mockRejectionsTrend = vi.fn();
const mockRejectionsByHostel = vi.fn();
const mockRejectionsByLeaveType = vi.fn();
const mockCountByHostel = vi.fn();
const mockCountByLeaveType = vi.fn();

vi.mock("@/db/repositories/leave/leave-rejection.repository", () => ({
  leaveRejectionRepository: {
    countBySource: (...args: any[]) => mockCountBySource(...args),
    trendByDateRange: (...args: any[]) => mockTrendByDateRange(...args),
    countByHostel: (...args: any[]) => mockCountByHostel(...args),
    countByLeaveType: (...args: any[]) => mockCountByLeaveType(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval-analytics.repository", () => ({
  leaveApprovalAnalyticsRepository: {
    rejectionsByStepKey: (...args: any[]) => mockRejectionsByStepKey(...args),
    rejectionsByCategory: (...args: any[]) => mockRejectionsByCategory(...args),
    rejectionsTrend: (...args: any[]) => mockRejectionsTrend(...args),
    rejectionsByHostel: (...args: any[]) => mockRejectionsByHostel(...args),
    rejectionsByLeaveType: (...args: any[]) => mockRejectionsByLeaveType(...args),
  },
}));

import { getRejectionAnalytics } from "@/services/analytics/get-rejection-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountBySource.mockResolvedValue(4);
  mockTrendByDateRange.mockResolvedValue([]);
  mockRejectionsByStepKey.mockResolvedValue([
    { stepKey: "ADMIN_APPROVAL", count: 3 },
    { stepKey: "PARENT_APPROVAL", count: 2 },
  ]);
  mockRejectionsByCategory.mockResolvedValue([{ category: "DOCUMENT", count: 2 }]);
  mockRejectionsTrend.mockResolvedValue([{ date: "2026-06-01", count: 5 }]);
  mockRejectionsByHostel.mockResolvedValue([{ name: "BH1", count: 2 }]);
  mockRejectionsByLeaveType.mockResolvedValue([{ name: "HOME_PASS", count: 3 }]);
  mockCountByHostel.mockResolvedValue([{ name: "GH1", count: 1 }]);
  mockCountByLeaveType.mockResolvedValue([{ name: "NIGHT_OUT", count: 1 }]);
});

describe("getRejectionAnalytics", () => {
  it("totals policy + human rejections and maps step labels", async () => {
    const result = await getRejectionAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.policyRejections).toBe(4);
    expect(result.humanRejections).toBe(5);
    expect(result.totalRejections).toBe(9);
    expect(result.bySource).toEqual([
      { name: "Policy", count: 4 },
      { name: "Admin", count: 3 },
      { name: "Parent", count: 2 },
    ]);
  });

  it("merges hostel and leave-type breakdowns across sources", async () => {
    const result = await getRejectionAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.byHostel).toContainEqual({ name: "BH1", count: 2 });
    expect(result.byHostel).toContainEqual({ name: "GH1", count: 1 });
    expect(result.byLeaveType).toContainEqual({ name: "HOME_PASS", count: 3 });
    expect(result.byLeaveType).toContainEqual({ name: "NIGHT_OUT", count: 1 });
  });
});
