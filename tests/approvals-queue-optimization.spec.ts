// @ts-nocheck
import { describe, expect, it, vi, beforeEach } from "vitest";

import { leaveApprovalRepository } from "@/db/repositories/leave/leave-approval.repository";
import { auditRepository } from "@/db/repositories/audit/audit.repository";

describe("Approval Queue Query & Scalability Optimization", () => {
  let joinedTables: string[];

  const createMockDbClient = (rows: any[] = []) => {
    joinedTables = [];
    const queryBuilder = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockImplementation((table: any) => {
        const name = table?.[Symbol.for("drizzle:Name")] ?? table?.name ?? "unknown";
        joinedTables.push(name);
        return queryBuilder;
      }),
      innerJoin: vi.fn().mockImplementation((table: any) => {
        const name = table?.[Symbol.for("drizzle:Name")] ?? table?.name ?? "unknown";
        joinedTables.push(name);
        return queryBuilder;
      }),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockImplementation(() => Promise.resolve(rows)),
      then: (resolve: any) => resolve(rows),
    };

    return queryBuilder;
  };

  it("countPendingApprovals does not join students or users", async () => {
    const mockDb = createMockDbClient([{ count: 3 }]);
    const count = await leaveApprovalRepository.countPendingApprovals(
      { hostelIds: ["hostel-1"] },
      mockDb as any
    );

    expect(count).toBe(3);
    expect(joinedTables).toContain("leave_requests");
    expect(joinedTables).not.toContain("students");
    expect(joinedTables).not.toContain("users");
  });

  it("countPendingExtensionApprovals does not join students or users", async () => {
    const mockDb = createMockDbClient([{ count: 2 }]);
    const count = await leaveApprovalRepository.countPendingExtensionApprovals(
      { hostelIds: ["hostel-1"] },
      mockDb as any
    );

    expect(count).toBe(2);
    expect(joinedTables).toContain("leave_extensions");
    expect(joinedTables).toContain("leave_requests");
    expect(joinedTables).not.toContain("students");
    expect(joinedTables).not.toContain("users");
  });

  it("auditRepository.findByEntityIds selects only lightweight columns (omits heavy diffs/blobs)", async () => {
    let capturedSelectFields: any = null;
    const mockDb = {
      select: vi.fn().mockImplementation((fields: any) => {
        capturedSelectFields = fields;
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([
                {
                  id: "audit-1",
                  entityId: "app-1",
                  action: "OVERRIDE",
                  metadata: null,
                },
              ]),
            }),
          }),
        };
      }),
    };

    const results = await auditRepository.findByEntityIds(
      "LEAVE_APPROVAL" as any,
      ["app-1"],
      mockDb as any
    );

    expect(results).toHaveLength(1);
    expect(capturedSelectFields).toBeDefined();
    // Verify oldData, newData, ipAddress, userAgent are omitted from select projections
    expect(capturedSelectFields.oldData).toBeUndefined();
    expect(capturedSelectFields.newData).toBeUndefined();
    expect(capturedSelectFields.userAgent).toBeUndefined();
    expect(capturedSelectFields.ipAddress).toBeUndefined();
    // Verify necessary fields are projected
    expect(capturedSelectFields.id).toBeDefined();
    expect(capturedSelectFields.entityId).toBeDefined();
    expect(capturedSelectFields.action).toBeDefined();
    expect(capturedSelectFields.metadata).toBeDefined();
  });
});
