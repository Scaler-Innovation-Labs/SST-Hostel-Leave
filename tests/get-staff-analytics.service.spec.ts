// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockStaffDecisionsSummary = vi.fn();
const mockStaffPendingCount = vi.fn();
const mockStaffActivityTrend = vi.fn();
const mockStaffDecisionsByRole = vi.fn();
const mockStaffApproverBreakdown = vi.fn();

vi.mock("@/db/repositories/leave/leave-approval-analytics.repository", () => ({
  leaveApprovalAnalyticsRepository: {
    staffDecisionsSummary: (...args: any[]) => mockStaffDecisionsSummary(...args),
    staffPendingCount: (...args: any[]) => mockStaffPendingCount(...args),
    staffActivityTrend: (...args: any[]) => mockStaffActivityTrend(...args),
    staffDecisionsByRole: (...args: any[]) => mockStaffDecisionsByRole(...args),
    staffApproverBreakdown: (...args: any[]) => mockStaffApproverBreakdown(...args),
  },
}));

import { getStaffAnalytics } from "@/services/analytics/get-staff-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockStaffDecisionsSummary.mockResolvedValue({
    totalDecisions: 25,
    totalApproved: 20,
    totalRejected: 5,
    activeApproversCount: 4,
    averageTurnaroundHours: 1.5,
  });
  mockStaffPendingCount.mockResolvedValue(12);
  mockStaffActivityTrend.mockResolvedValue([
    { date: "2026-10-15", approved: 3, rejected: 1 },
    { date: "2026-10-16", approved: 5, rejected: 0 },
  ]);
  mockStaffDecisionsByRole.mockResolvedValue([
    { role: "ADMIN", approvedCount: 15, rejectedCount: 3, totalDecisions: 18, averageTurnaroundHours: 1.2 },
    { role: "POC", approvedCount: 5, rejectedCount: 2, totalDecisions: 7, averageTurnaroundHours: 2.1 },
  ]);
  mockStaffApproverBreakdown.mockResolvedValue([
    {
      userId: "U1",
      name: "Sunil Kumar",
      role: "ADMIN",
      approvedCount: 15,
      rejectedCount: 3,
      totalDecisions: 18,
      averageTurnaroundHours: 1.2,
    },
  ]);
});

describe("getStaffAnalytics", () => {
  it("aggregates staff decisions metrics accurately", async () => {
    const result = await getStaffAnalytics({ id: "U_ADMIN", roles: ["SUPER_ADMIN"] }, "30d");

    expect(result.period).toBe("30d");
    expect(result.totalDecisions).toBe(25);
    expect(result.totalApproved).toBe(20);
    expect(result.totalRejected).toBe(5);
    expect(result.pendingOnStaff).toBe(12);
    expect(result.activeApproversCount).toBe(4);
    expect(result.averageTurnaroundHours).toBe(1.5);
    expect(result.byRole).toHaveLength(2);
    expect(result.byDecision).toEqual([
      { name: "Approved", count: 20 },
      { name: "Rejected", count: 5 },
    ]);
    expect(result.approvers).toHaveLength(1);
    expect(result.approvers[0].name).toBe("Sunil Kumar");
  });

  it("returns bounded filled activity trend for 7d", async () => {
    const result = await getStaffAnalytics({ id: "U_ADMIN", roles: ["SUPER_ADMIN"] }, "7d");

    expect(result.period).toBe("7d");
    expect(result.activityTrend.length).toBeGreaterThanOrEqual(7);
  });
});
