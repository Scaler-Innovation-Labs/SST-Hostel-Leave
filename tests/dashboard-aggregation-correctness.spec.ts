import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockGetLocationAndUserStats = vi.fn();
const mockCountPendingStats = vi.fn();
const mockCountStatusStats = vi.fn();
const mockCountRecent = vi.fn();
const mockCountByLeaveType = vi.fn();
const mockAverageApprovalTime = vi.fn();
const mockCountActive = vi.fn();
const mockCountRecentMovement = vi.fn();
const mockCountByDateRange = vi.fn();
const mockCountByDateRangeApproval = vi.fn();

vi.mock("@/db/repositories/dashboard/staff-metrics.repository", () => ({
  staffMetricsRepository: {
    getLocationAndUserStats: (...args: any[]) => mockGetLocationAndUserStats(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval-analytics.repository", () => ({
  leaveApprovalAnalyticsRepository: {
    countPendingStats: (...args: any[]) => mockCountPendingStats(...args),
    countRecent: (...args: any[]) => mockCountRecent(...args),
    averageApprovalTime: (...args: any[]) => mockAverageApprovalTime(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRangeApproval(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    countStatusStats: (...args: any[]) => mockCountStatusStats(...args),
    countByLeaveType: (...args: any[]) => mockCountByLeaveType(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRange(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    countActive: (...args: any[]) => mockCountActive(...args),
  },
}));

vi.mock("@/db/repositories/movement/movement-event.repository", () => ({
  movementEventRepository: {
    countRecent: (...args: any[]) => mockCountRecentMovement(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn(),
  getScopedHostelIds: vi.fn(),
}));

import { getDashboardStats } from "@/services/dashboard/get-dashboard-stats.service";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

describe("Dashboard Aggregation & Correctness Regression Tests", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mockGetLocationAndUserStats.mockResolvedValue({
      total: 100,
      active: 85,
      inHostel: 70,
      outsideHostel: 25,
      overdue: 5,
      totalUsers: 125,
    });
    mockCountPendingStats.mockResolvedValue({
      pendingLeaves: 3,
      pendingExtensions: 1,
    });
    mockCountStatusStats.mockResolvedValue({
      total: 250,
      approved: 200,
      rejected: 20,
      expired: 10,
      completed: 15,
      cancelled: 5,
    });
    mockCountRecent.mockResolvedValue(12);
    mockCountByLeaveType.mockResolvedValue([{ leaveType: "EMERGENCY", count: 4 }]);
    mockAverageApprovalTime.mockResolvedValue(2.5);
    mockCountActive.mockResolvedValue(18);
    mockCountRecentMovement.mockResolvedValue(30);
    mockCountByDateRange.mockResolvedValue([]);
    mockCountByDateRangeApproval.mockResolvedValue([]);
  });

  it("super-admin dashboard queries unscoped metrics across all hostels", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(false);

    const superAdminUser = { id: "SA_1", roles: ["SUPER_ADMIN"] };
    const stats = await getDashboardStats(superAdminUser);

    expect(mockGetLocationAndUserStats).toHaveBeenCalledWith(undefined);
    expect(stats.totalStudents).toBe(100);
    expect(stats.totalUsers).toBe(125);
    expect(stats.totalUsers).toBeGreaterThan(stats.totalStudents); // includes staff/admin users
    expect(stats.activeStudents).toBe(85);
    expect(stats.inHostel).toBe(70);
    expect(stats.studentsOutside).toBe(25);
    expect(stats.overdueStudents).toBe(5);
  });

  it("hostel-scoped staff dashboard restricts query strictly to authorized hostel", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(true);
    vi.mocked(getScopedHostelIds).mockReturnValue(["HOSTEL_A"]);

    const wardenUser = { id: "W_1", roles: ["ADMIN"] };
    const stats = await getDashboardStats(wardenUser);

    expect(mockGetLocationAndUserStats).toHaveBeenCalledWith(["HOSTEL_A"]);
    expect(stats.totalStudents).toBe(100);
    expect(stats.totalUsers).toBe(125);
  });

  it("isolates different hostels cleanly without data cross-leakage", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(true);
    vi.mocked(getScopedHostelIds).mockReturnValue(["HOSTEL_B"]);

    mockGetLocationAndUserStats.mockResolvedValueOnce({
      total: 40,
      active: 40,
      inHostel: 35,
      outsideHostel: 5,
      overdue: 0,
      totalUsers: 45,
    });

    const wardenUserB = { id: "W_2", roles: ["ADMIN"] };
    const statsB = await getDashboardStats(wardenUserB);

    expect(mockGetLocationAndUserStats).toHaveBeenCalledWith(["HOSTEL_B"]);
    expect(statsB.totalStudents).toBe(40);
    expect(statsB.totalUsers).toBe(45);
    expect(statsB.inHostel).toBe(35);
  });

  it("handles completely empty hostel without errors or NaN", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(true);
    vi.mocked(getScopedHostelIds).mockReturnValue(["EMPTY_HOSTEL"]);

    mockGetLocationAndUserStats.mockResolvedValueOnce({
      total: 0,
      active: 0,
      inHostel: 0,
      outsideHostel: 0,
      overdue: 0,
      totalUsers: 0,
    });
    mockCountPendingStats.mockResolvedValueOnce({ pendingLeaves: 0, pendingExtensions: 0 });
    mockCountStatusStats.mockResolvedValueOnce({
      total: 0,
      approved: 0,
      rejected: 0,
      expired: 0,
      completed: 0,
      cancelled: 0,
    });

    const staffUser = { id: "W_EMPTY", roles: ["ADMIN"] };
    const stats = await getDashboardStats(staffUser);

    expect(stats.totalStudents).toBe(0);
    expect(stats.activeStudents).toBe(0);
    expect(stats.totalUsers).toBe(0);
    expect(stats.inHostel).toBe(0);
    expect(stats.studentsOutside).toBe(0);
    expect(stats.overdueStudents).toBe(0);
    expect(stats.totalLeaves).toBe(0);
  });

  it("distinguishes active from inactive users and students correctly", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(false);

    mockGetLocationAndUserStats.mockResolvedValueOnce({
      total: 100,
      active: 75, // 25 inactive
      inHostel: 60,
      outsideHostel: 15,
      overdue: 0,
      totalUsers: 110,
    });

    const adminUser = { id: "ADMIN_1", roles: ["ADMIN"] };
    const stats = await getDashboardStats(adminUser);

    expect(stats.totalStudents).toBe(100);
    expect(stats.activeStudents).toBe(75);
    expect(stats.totalStudents - stats.activeStudents).toBe(25);
  });

  it("preserves exact existing response contract shape", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(false);

    const stats = await getDashboardStats({ id: "POC_1", roles: ["POC"] });

    // Verify all contract keys are present and typed as expected
    expect(stats).toHaveProperty("totalStudents");
    expect(stats).toHaveProperty("activeStudents");
    expect(stats).toHaveProperty("inHostel");
    expect(stats).toHaveProperty("studentsOnLeave");
    expect(stats).toHaveProperty("pendingApprovals");
    expect(stats).toHaveProperty("pendingExtensions");
    expect(stats).toHaveProperty("overdueStudents");
    expect(stats).toHaveProperty("studentsOutside");
    expect(stats).toHaveProperty("totalUsers");
    expect(stats).toHaveProperty("totalLeaves");
    expect(stats).toHaveProperty("approvedLeaves");
    expect(stats).toHaveProperty("rejectedLeaves");
    expect(stats).toHaveProperty("expiredLeaves");
    expect(stats).toHaveProperty("completedLeaves");
    expect(stats).toHaveProperty("cancelledLeaves");
    expect(stats).toHaveProperty("recentApprovalsCount");
    expect(stats).toHaveProperty("averageApprovalHours");
    expect(stats).toHaveProperty("activeQrPasses");
    expect(stats).toHaveProperty("movementEvents");
    expect(stats).toHaveProperty("leaveTypeBreakdown");
    expect(stats).toHaveProperty("leavesLast7Days");
    expect(stats).toHaveProperty("leavesLast30Days");
    expect(stats).toHaveProperty("approvalsLast7Days");
  });

  it("fails if user count is naively equated to student count", async () => {
    vi.mocked(isStaffScopeRestricted).mockReturnValue(false);

    // In reality, totalUsers includes wardens, POCs, admins, guards.
    mockGetLocationAndUserStats.mockResolvedValueOnce({
      total: 50,
      active: 50,
      inHostel: 40,
      outsideHostel: 10,
      overdue: 0,
      totalUsers: 65, // 50 students + 15 staff users
    });

    const stats = await getDashboardStats({ id: "SA_1", roles: ["SUPER_ADMIN"] });

    expect(stats.totalStudents).toBe(50);
    expect(stats.totalUsers).toBe(65);
    // If someone accidentally assigns totalUsers = totalStudents:
    expect(stats.totalUsers).not.toBe(stats.totalStudents);
  });
});
