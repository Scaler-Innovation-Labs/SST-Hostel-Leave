// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockCountUsers = vi.fn();
const mockCountAll = vi.fn();
const mockCountByLocationState = vi.fn();
const mockCountByHostel = vi.fn();
const mockCountByDepartment = vi.fn();
const mockCountByAcademicGroup = vi.fn();
const mockCountByGender = vi.fn();
const mockTrendByDateRange = vi.fn();

vi.mock("@/db/repositories/user/user.repository", () => ({
  userRepository: { count: (...args: any[]) => mockCountUsers(...args) },
}));

vi.mock("@/db/repositories/student/student.repository", () => ({
  studentRepository: {
    countAll: (...args: any[]) => mockCountAll(...args),
    countByLocationState: (...args: any[]) => mockCountByLocationState(...args),
  },
}));

vi.mock("@/db/repositories/student/student-analytics.repository", () => ({
  studentAnalyticsRepository: {
    countByHostel: (...args: any[]) => mockCountByHostel(...args),
    countByDepartment: (...args: any[]) => mockCountByDepartment(...args),
    countByAcademicGroup: (...args: any[]) => mockCountByAcademicGroup(...args),
    countByGender: (...args: any[]) => mockCountByGender(...args),
    trendByDateRange: (...args: any[]) => mockTrendByDateRange(...args),
  },
}));

import { getStudentAnalytics } from "@/services/analytics/get-student-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountUsers.mockResolvedValue(150);
  mockCountAll.mockResolvedValue(120);
  mockCountByLocationState.mockImplementation((state) => Promise.resolve(state === "IN_HOSTEL" ? 100 : state === "OUTSIDE_HOSTEL" ? 15 : 5));
  mockCountByHostel.mockResolvedValue([{ hostel: "BH1", count: 60 }]);
  mockCountByDepartment.mockResolvedValue([{ department: "CSE", count: 40 }]);
  mockCountByAcademicGroup.mockResolvedValue([{ group: "2024", count: 80 }]);
  mockCountByGender.mockResolvedValue([{ gender: "M", count: 70 }]);
  mockTrendByDateRange.mockResolvedValue([]);
});

describe("getStudentAnalytics", () => {
  it("maps movement-state counts into top-level fields", async () => {
    const result = await getStudentAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.totalUsers).toBe(150);
    expect(result.totalStudents).toBe(120);
    expect(result.inHostel).toBe(100);
    expect(result.onLeave).toBe(15);
    expect(result.overdue).toBe(5);
  });

  it("returns bounded trend for the default period", async () => {
    const result = await getStudentAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.period).toBe("30d");
    expect(result.trend.length).toBeGreaterThan(20);
  });
});
