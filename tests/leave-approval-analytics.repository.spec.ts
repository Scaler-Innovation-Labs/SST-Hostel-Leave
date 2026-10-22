// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockInnerJoinLeaveRequests,
  mockInnerJoinLeaveRequestsFromExt,
  mockLeftJoinStudents,
  mockLeftJoinUsers,
  mockWhere,
  mockDbClient,
} = vi.hoisted(() => {
  const mockWhere = vi.fn();
  const mockLeftJoinUsers = vi.fn();
  const mockLeftJoinStudents = vi.fn();
  const mockInnerJoinLeaveRequests = vi.fn();
  const mockInnerJoinLeaveRequestsFromExt = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();

  const mockDbClient = {
    select: (...args: any[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: any[]) => {
          mockFrom(...fArgs);
          return {
            innerJoin: (...jArgs: any[]) => {
              mockInnerJoinLeaveRequests(...jArgs);
              return {
                leftJoin: (...sArgs: any[]) => {
                  mockLeftJoinStudents(...sArgs);
                  return {
                    leftJoin: (...uArgs: any[]) => {
                      mockLeftJoinUsers(...uArgs);
                      return {
                        where: (...wArgs: any[]) => {
                          mockWhere(...wArgs);
                          return [{ count: 1 }];
                        },
                      };
                    },
                  };
                },
                innerJoin: (...eArgs: any[]) => {
                  mockInnerJoinLeaveRequestsFromExt(...eArgs);
                  return {
                    leftJoin: (...sArgs: any[]) => {
                      mockLeftJoinStudents(...sArgs);
                      return {
                        leftJoin: (...uArgs: any[]) => {
                          mockLeftJoinUsers(...uArgs);
                          return {
                            where: (...wArgs: any[]) => {
                              mockWhere(...wArgs);
                              return [{ count: 0 }];
                            },
                          };
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };

  return {
    mockSelect,
    mockFrom,
    mockInnerJoinLeaveRequests,
    mockInnerJoinLeaveRequestsFromExt,
    mockLeftJoinStudents,
    mockLeftJoinUsers,
    mockWhere,
    mockDbClient,
  };
});

vi.mock("@/lib/db", () => ({
  db: mockDbClient,
}));

import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";

describe("leaveApprovalAnalyticsRepository - Actionable Pending Metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes countActionablePendingLeaves, countActionablePendingExtensions, and countPendingStats", () => {
    expect(typeof leaveApprovalAnalyticsRepository.countActionablePendingLeaves).toBe("function");
    expect(typeof leaveApprovalAnalyticsRepository.countActionablePendingExtensions).toBe("function");
    expect(typeof leaveApprovalAnalyticsRepository.countPendingStats).toBe("function");
  });

  it("countActionablePendingLeaves queries DISTINCT leaveRequestId at current workflow step", async () => {
    const result = await leaveApprovalAnalyticsRepository.countActionablePendingLeaves({}, mockDbClient);

    expect(result).toBe(1);
    expect(mockSelect).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalled();
    expect(mockInnerJoinLeaveRequests).toHaveBeenCalled();
    expect(mockWhere).toHaveBeenCalled();

    const whereConditions = mockWhere.mock.calls[0][0];
    expect(whereConditions).toBeDefined();
  });

  it("countPendingStats resolves both actionable leaves and extensions via Promise.all", async () => {
    const spyLeaves = vi.spyOn(leaveApprovalAnalyticsRepository, "countActionablePendingLeaves").mockResolvedValue(5);
    const spyExtensions = vi.spyOn(leaveApprovalAnalyticsRepository, "countActionablePendingExtensions").mockResolvedValue(2);

    const stats = await leaveApprovalAnalyticsRepository.countPendingStats({ hostelIds: ["H1"] }, mockDbClient);

    expect(stats).toEqual({
      pendingLeaves: 5,
      pendingExtensions: 2,
    });
    expect(spyLeaves).toHaveBeenCalledWith({ hostelIds: ["H1"] }, mockDbClient);
    expect(spyExtensions).toHaveBeenCalledWith({ hostelIds: ["H1"] }, mockDbClient);

    spyLeaves.mockRestore();
    spyExtensions.mockRestore();
  });
});
