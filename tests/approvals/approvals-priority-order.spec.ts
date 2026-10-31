// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockOrderBy = vi.fn();
const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockGroupBy = vi.fn();
const mockWhere = vi.fn();
const mockLeftJoin = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();

vi.mock("@/lib/db", () => {
  const queryChain = {
    from: (...args: any[]) => {
      mockFrom(...args);
      return queryChain;
    },
    leftJoin: (...args: any[]) => {
      mockLeftJoin(...args);
      return queryChain;
    },
    innerJoin: (...args: any[]) => queryChain,
    where: (...args: any[]) => {
      mockWhere(...args);
      return queryChain;
    },
    groupBy: (...args: any[]) => {
      mockGroupBy(...args);
      return queryChain;
    },
    orderBy: (...args: any[]) => {
      mockOrderBy(...args);
      return queryChain;
    },
    limit: (...args: any[]) => {
      mockLimit(...args);
      return queryChain;
    },
    offset: (...args: any[]) => {
      mockOffset(...args);
      return Promise.resolve([{ leaveRequestId: "lr-1" }]);
    },
    then: (resolve: any) => resolve([{ count: 1 }]),
  };

  return {
    db: {
      select: (...args: any[]) => {
        mockSelect(...args);
        return queryChain;
      },
      transaction: (cb: any) => cb({ select: (...args: any[]) => queryChain }),
    },
  };
});

import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";

describe("leaveApprovalRepository approval queue priority sorting", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies priority sorting (Admin -> Parent -> POC -> Other Pending -> Decided) to pageIdRows query", async () => {
    // When groupByLeaveRequest is true, pageIdRows executes and applies .orderBy(...)
    try {
      await leaveApprovalRepository.findByFilters({
        page: 1,
        limit: 10,
        groupByLeaveRequest: true,
      });
    } catch {
      // In mocked environment, later joins/selects might throw or resolve empty
    }

    expect(mockOrderBy).toHaveBeenCalled();
    const orderByArgs = mockOrderBy.mock.calls[0];
    expect(orderByArgs).toBeDefined();

    // The first orderBy argument must be the priority CASE SQL expression
    const prioritySql = orderByArgs[0];
    const sqlChunks = prioritySql?.queryChunks ?? [];
    const sqlString = sqlChunks
      .map((c: any) => (typeof c === "string" ? c : c?.value ?? ""))
      .join(" ");

    expect(sqlString).toContain("CASE");
    expect(sqlString).toContain("ADMIN");
    expect(sqlString).toContain("PARENT");
    expect(sqlString).toContain("POC");
  });
});
