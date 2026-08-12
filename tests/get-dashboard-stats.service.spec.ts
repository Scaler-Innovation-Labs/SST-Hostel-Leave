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

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    findByUserId: (...args: any[]) => mockFindByUserId(...args),
    countAll: (...args: any[]) => mockCountAll(...args),
    countByLocationState: (...args: any[]) => mockCountByLocationState(...args),
  },
}));

vi.mock("@/db/repositories/leave/leave.repository", () => ({
  leaveRepository: {
    findByFilters: (...args: any[]) => mockFindByFilters(...args),
    countAll: (...args: any[]) => mockCountAll(...args),
    countByStatus: (...args: any[]) => mockCountByStatus(...args),
    countByLeaveType: (...args: any[]) => mockCountByLeaveType(...args),
    countByDateRange: (...args: any[]) => mockCountByDateRange(...args),
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
  mockCountUsers.mockResolvedValue(0);
  mockCountByLocationState.mockResolvedValue(0);
});

describe("getDashboardStats", () => {
  it("throws NotFoundError for a student without a profile", async () => {
    mockFindByUserId.mockResolvedValue(null);

    await expect(getDashboardStats(STUDENT_USER)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("returns student stats with counts", async () => {
    mockFindByFilters.mockImplementation((filters) => {
      if (filters.status === "PENDING") return { items: [], total: 3 };
      return { items: [{ leave: { id: "LR1", status: "APPROVED", startAt: new Date(), endAt: new Date() }, leaveType: { name: "Home Pass" } }], total: 1 };
    });

    const result = await getDashboardStats(STUDENT_USER);

    expect(result.pendingLeaves).toBe(3);
    expect(result.approvedLeaves).toBe(1);
    expect(result.activeLeave.id).toBe("LR1");
    expect(result.activeLeave.leaveType).toBe("Home Pass");
    expect(result.currentLocation).toBe("IN_HOSTEL");
    expect(result.activeQr).toBeNull();
  });

  it("returns an active QR pass for the student", async () => {
    mockFindByFilters.mockResolvedValue({ items: [], total: 0 });
    mockFindByStudentId.mockResolvedValue([
      {
        id: "QP1",
        status: "ACTIVE",
        tokenHash: "abcdef123456",
        expiresAt: new Date(Date.now() + 86400000),
      },
    ]);

    const result = await getDashboardStats(STUDENT_USER);

    expect(result.activeQr).not.toBeNull();
    expect(result.activeQr.passId).toBe("QP1");
    expect(result.activeQr.token).toBe("abcdef12...");
  });

  it("returns staff stats and passes the status filter to countByLeaveType", async () => {
    mockCountAll.mockResolvedValue(100);
    mockCountByStatus.mockResolvedValue(10);
    mockCountPendingByType.mockResolvedValue(4);
    mockCountByLeaveType.mockResolvedValue([{ leaveType: "HOME_PASS", count: 3 }]);

    const result = await getDashboardStats(ADMIN_USER, "APPROVED");

    expect(result.totalStudents).toBe(100);
    expect(result.pendingApprovals).toBe(4);
    expect(mockCountByLeaveType).toHaveBeenCalledWith(undefined, "APPROVED");
  });

  it("passes scoped hostel ids for scope-restricted staff", async () => {
    const { isStaffScopeRestricted, getScopedHostelIds } = await import("@/services/shared/authorization.service");
    isStaffScopeRestricted.mockReturnValue(true);
    getScopedHostelIds.mockReturnValue(["H1"]);

    await getDashboardStats(ADMIN_USER);

    expect(mockCountAll).toHaveBeenCalledWith(["H1"]);
    expect(mockCountByLeaveType).toHaveBeenCalledWith(["H1"], undefined);
  });
});
