// @ts-nocheck
import { describe, expect, it, vi } from "vitest";

import { leaveApprovalParentDetails } from "@/db";
import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";

describe("leaveApprovalAnalyticsRepository - staff analytics query joins", () => {
  it("staffDecisionsSummary leftJoins leaveApprovalParentDetails", async () => {
    const joinedTables: any[] = [];

    const createChain = () => {
      const chain: any = {
        leftJoin: vi.fn((table, _condition) => {
          joinedTables.push(table);
          return chain;
        }),
        where: vi.fn(() => [{
          totalDecisions: 10,
          totalApproved: 8,
          totalRejected: 2,
          activeApproversCount: 3,
          avgHours: 2.5,
        }]),
      };
      return chain;
    };

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => createChain()),
      })),
    };

    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");

    const result = await leaveApprovalAnalyticsRepository.staffDecisionsSummary(
      startDate,
      endDate,
      undefined,
      mockDb as any
    );

    expect(result.totalDecisions).toBe(10);
    expect(result.totalApproved).toBe(8);
    expect(result.totalRejected).toBe(2);
    // Verifies that leaveApprovalParentDetails is joined to prevent missing FROM clause in PostgreSQL
    expect(joinedTables).toContain(leaveApprovalParentDetails);
  });

  it("staffActivityTrend leftJoins leaveApprovalParentDetails", async () => {
    const joinedTables: any[] = [];

    const createChain = () => {
      const chain: any = {
        leftJoin: vi.fn((table, _condition) => {
          joinedTables.push(table);
          return chain;
        }),
        where: vi.fn(() => chain),
        groupBy: vi.fn(() => chain),
        orderBy: vi.fn(() => [
          { date: "2026-01-15", approved: 5, rejected: 1 },
        ]),
      };
      return chain;
    };

    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => createChain()),
      })),
    };

    const startDate = new Date("2026-01-01");
    const endDate = new Date("2026-01-31");

    const result = await leaveApprovalAnalyticsRepository.staffActivityTrend(
      startDate,
      endDate,
      undefined,
      mockDb as any
    );

    expect(result).toHaveLength(1);
    expect(result[0].approved).toBe(5);
    // Verifies that leaveApprovalParentDetails is joined to prevent missing FROM clause in PostgreSQL
    expect(joinedTables).toContain(leaveApprovalParentDetails);
  });
});
