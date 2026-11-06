// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/lib/db/transaction", () => ({
  transaction: (cb: any) => cb({}),
}));

const mockFindByUserId = vi.fn();
const mockFindByFilters = vi.fn();
const mockCountAll = vi.fn();
const mockCountByStatus = vi.fn();
const mockCountByLeaveType = vi.fn();
const mockCountByDateRange = vi.fn();
const mockFindByLeaveRequestId = vi.fn();
const mockCountPendingByType = vi.fn();
const mockCountRecent = vi.fn();
const mockAverageApprovalTime = vi.fn();
const mockCountByDateRangeApproval = vi.fn();
const mockFindLatestByStudentId = vi.fn();
const mockFindByFiltersMovement = vi.fn();
const mockCountRecentMovement = vi.fn();
const mockFindByStudentId = vi.fn();
const mockCountActive = vi.fn();
const mockCountUsers = vi.fn();
const mockCountByLocationState = vi.fn();
const mockCountLocationStats = vi.fn();
const mockCountStatusStats = vi.fn();
const mockCountPendingStats = vi.fn();
const mockGetLocationAndUserStats = vi.fn();

vi.mock("@/db/repositories/dashboard/staff-metrics.repository", () => ({
  staffMetricsRepository: {
    getLocationAndUserStats: (...args: any[]) => mockGetLocationAndUserStats(...args),
  },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
    countAll: (...args: any[]) => mockCountAll(...args),
    countByLocationState: (...args: any[]) => mockCountByLocationState(...args),
    countLocationStats: (...args: any[]) => mockCountLocationStats(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
    countAll: (...args: any[]) => mockCountAll(...args),
    countByStatus: (...args: any[]) => mockCountByStatus(...args),
    countByLeaveType: (...args: any[]) => mockCountByLeaveType(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRange(...args),
    countStatusStats: (...args: any[]) => mockCountStatusStats(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval.repository", () => ({
  leaveApprovalRepository: {
    findByLeaveRequestId: (...args: any[]) => mockFindByLeaveRequestId(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave-approval-analytics.repository", () => ({
  leaveApprovalAnalyticsRepository: {
    countPendingByType: (...args: any[]) => mockCountPendingByType(...args),
    countRecent: (...args: any[]) => mockCountRecent(...args),
    averageApprovalTime: (...args: any[]) => mockAverageApprovalTime(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRangeApproval(...args),
    countPendingStats: (...args: any[]) => mockCountPendingStats(...args),
  },
}));

vi.mock("@/db/repositories/movement/movement-event.repository", () => ({
  movementEventRepository: {
    findLatestByStudentId: (...args: any[]) => mockFindLatestByStudentId(...args),
    findByFilters: (...args: any[]) => mockFindByFiltersMovement(...args),
    countRecent: (...args: any[]) => mockCountRecentMovement(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    findByStudentId: (...args: any[]) => mockFindByStudentId(...args),
    countActive: (...args: any[]) => mockCountActive(...args),
  },
}));

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: {
    count: (...args: any[]) => mockCountUsers(...args),
  },
}));

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue(["H1"]),
}));

import { getDashboardStats } from "@/services/dashboard/get-dashboard-stats.service";
import { NotFoundError } from "@/lib/errors";

const STUDENT_USER = { id: "U1", roles: ["STUDENT"] };
const ADMIN_USER = { id: "U2", roles: ["ADMIN"] };

beforeEach(() => {
  vi.resetAllMocks();

  // student path defaults
  mockFindByUserId.mockResolvedValue({ id: "S1", currentLocationState: "IN_HOSTEL" });
  mockFindByFilters.mockImplementation((filters) => {
    if (filters.status === "PENDING") return { items: [], total: 0 };
    return { items: [], total: 0 };
  });
  mockFindByLeaveRequestId.mockResolvedValue([]);
  mockFindLatestByStudentId.mockResolvedValue(null);
  mockFindByStudentId.mockResolvedValue([]);
  mockFindByFiltersMovement.mockResolvedValue({ items: [], total: 0 });

  // staff path defaults
  mockCountAll.mockResolvedValue(0);
  mockCountByStatus.mockResolvedValue(0);
  mockCountByLeaveType.mockResolvedValue([]);
  mockCountByDateRange.mockResolvedValue([]);
  mockCountPendingByType.mockResolvedValue(0);
  mockCountRecent.mockResolvedValue(0);
  mockAverageApprovalTime.mockResolvedValue(null);
  mockCountByDateRangeApproval.mockResolvedValue([]);
  mockCountRecentMovement.mockResolvedValue(0);
  mockCountActive.mockResolvedValue(0);
  mockCountUsers.mockResolvedValue(120);
  mockCountByLocationState.mockResolvedValue(0);
  mockCountLocationStats.mockResolvedValue({ total: 100, active: 85, inHostel: 80, outsideHostel: 15, overdue: 5 });
  mockGetLocationAndUserStats.mockResolvedValue({
    total: 100,
    active: 85,
    inHostel: 80,
    outsideHostel: 15,
    overdue: 5,
    totalUsers: 120,
  });
  mockCountStatusStats.mockResolvedValue({ total: 200, approved: 150, rejected: 10, expired: 25, completed: 15, cancelled: 5 });
  mockCountPendingStats.mockResolvedValue({ pendingLeaves: 4, pendingExtensions: 1 });
});

describe("getDashboardStats", () => {
  it("throws NotFoundError for a student without a profile", async () => {
    mockFindByUserId.mockResolvedValue(null);

    await expect(getDashboardStats(STUDENT_USER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns student stats with counts", async () => {
    const now = new Date();
    mockFindByFilters.mockImplementation((filters) => {
      if (filters.status === "PENDING") return { items: [], total: 3 };
      return {
        items: [
          {
            leave: { id: "LR1", status: "APPROVED", startAt: new Date(now.getTime() - 3600000), endAt: new Date(now.getTime() + 3600000) },
            leaveType: { name: "Home Pass" },
          },
        ],
        total: 5,
      };
    });
    mockFindByLeaveRequestId.mockResolvedValue([
      { stepKey: "PARENT_APPROVAL", stepOrder: 1, decision: "APPROVED", actedAt: null },
    ]);
    mockFindByFiltersMovement.mockResolvedValue({
      items: [{ eventType: "EXIT_HOSTEL", occurredAt: now }],
      total: 1,
    });

    const result = await getDashboardStats(STUDENT_USER);

    expect(result.pendingLeaves).toBe(3);
    expect(result.approvedLeaves).toBe(5);
    expect(result.activeLeave?.id).toBe("LR1");
    expect(result.activeLeave?.leaveType).toBe("Home Pass");
    expect(result.approvalProgress).toHaveLength(1);
    expect(result.approvalProgress?.[0]?.label).toBe("Parent");
    expect(result.recentActivity).toHaveLength(1);
    expect(result.recentActivity[0]?.description).toBe("Left hostel");
  });

  it("returns null for optional fields when not found", async () => {
    const result = await getDashboardStats(STUDENT_USER);

    expect(result.activeLeave).toBeNull();
    expect(result.upcomingLeave).toBeNull();
    expect(result.activeQr).toBeNull();
    expect(result.approvalProgress).toBeNull();
  });

  it("resolves the current leave from an open movement session even when outside the window", async () => {
    const now = new Date();
    // Pass has firstScanAt but no closedAt — student physically outside/overdue
    mockFindByStudentId.mockResolvedValue([
      {
        id: "QP_ACTIVE",
        leaveRequestId: "LR_A",
        status: "ACTIVE",
        firstScanAt: new Date(now.getTime() - 2 * 86400000),
        closedAt: null,
        expiresAt: new Date(now.getTime() + 86400000),
      },
    ]);
    mockFindByFilters.mockImplementation((filters) => {
      if (filters.status === "PENDING") return { items: [], total: 0 };
      return {
        items: [
          {
            // This leave's endAt is in the past, but its QR pass has an open session!
            leave: {
              id: "LR_A",
              status: "APPROVED",
              startAt: new Date(now.getTime() - 3 * 86400000),
              endAt: new Date(now.getTime() - 86400000),
            },
            leaveType: { name: "Home Pass" },
          },
          {
            // Another approved leave whose window is currently active
            leave: {
              id: "LR_B",
              status: "APPROVED",
              startAt: new Date(now.getTime() - 3600000),
              endAt: new Date(now.getTime() + 3600000),
            },
            leaveType: { name: "Weekend Pass" },
          },
        ],
        total: 2,
      };
    });

    const result = await getDashboardStats(STUDENT_USER);

    // The leave's window has ended but the session is still open (student
    // outside/overdue) — it remains the current leave.
    expect(result.activeLeave?.id).toBe("LR_A");
  });

  it("reflects qrMode on activeLeave and upcomingLeave correctly", async () => {
    const now = new Date();
    mockFindByFilters.mockImplementation((filters) => {
      if (filters.status === "PENDING") return { items: [], total: 0 };
      return {
        items: [
          {
            leave: {
              id: "LR_NONE",
              status: "APPROVED",
              startAt: new Date(now.getTime() - 86400000),
              endAt: new Date(now.getTime() + 86400000),
            },
            leaveType: { name: "Attendance Exception", qrMode: "NONE" },
          },
          {
            leave: {
              id: "LR_FUTURE",
              status: "APPROVED",
              startAt: new Date(now.getTime() + 2 * 86400000),
              endAt: new Date(now.getTime() + 3 * 86400000),
            },
            leaveType: { name: "Home Pass", qrMode: "BOTH" },
          },
        ],
        total: 2,
      };
    });

    const result = await getDashboardStats(STUDENT_USER);
    expect(result.activeLeave?.id).toBe("LR_NONE");
    expect(result.activeLeave?.qrMode).toBe("NONE");
    expect(result.activeQr).toBeNull();
    expect(result.upcomingLeave?.id).toBe("LR_FUTURE");
    expect(result.upcomingLeave?.qrMode).toBe("BOTH");
  });

  it("returns staff stats and passes the status filter to countByLeaveType", async () => {
    mockCountAll.mockResolvedValue(100);
    mockCountByStatus.mockResolvedValue(10);
    mockCountPendingByType.mockResolvedValue(4);
    mockCountByLeaveType.mockResolvedValue([{ leaveType: "HOME_PASS", count: 3 }]);

    const result = await getDashboardStats(ADMIN_USER, "APPROVED");

    expect(result.totalStudents).toBe(100);
    expect(result.activeStudents).toBe(85);
    expect(result.inHostel).toBe(80);
    expect(result.pendingApprovals).toBe(4);
    expect(result.expiredLeaves).toBe(25);
    expect(result.completedLeaves).toBe(15);
    expect(result.cancelledLeaves).toBe(5);
    expect(mockCountByLeaveType).toHaveBeenCalledWith(undefined, "APPROVED");
  });

  it("passes scoped hostel ids for scope-restricted staff", async () => {
    const { isStaffScopeRestricted, getScopedHostelIds } = await import("@/services/shared/authorization.service");
    isStaffScopeRestricted.mockReturnValue(true);
    getScopedHostelIds.mockReturnValue(["H1"]);

    await getDashboardStats(ADMIN_USER);

    expect(mockGetLocationAndUserStats).toHaveBeenCalledWith(["H1"]);
    expect(mockCountByLeaveType).toHaveBeenCalledWith(["H1"], undefined);
  });

  it("rejects a GUARD from the staff stats path", async () => {
    await expect(
      getDashboardStats({ id: "U9", roles: ["GUARD"] })
    ).rejects.toThrow("Only staff can access dashboard statistics");
  });
});
