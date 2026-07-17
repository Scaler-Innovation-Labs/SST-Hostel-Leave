import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { leaveApprovals } from "@/db";
import { db } from "@/lib/db";

export type LeaveApproval = InferSelectModel<typeof leaveApprovals>;

export const leaveApprovalAnalyticsRepository = {
  async countRecent(
    since: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .where(gte(leaveApprovals.createdAt, since));

    return Number(result[0]?.count ?? 0);
  },

  async averageApprovalTime(
    since: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number | null> {
    const result = await dbClient
      .select({
        avgHours: sql<number>`EXTRACT(EPOCH FROM AVG(${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600`,
      })
      .from(leaveApprovals)
      .where(
        and(
          gte(leaveApprovals.createdAt, since),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED),
          sql`${leaveApprovals.actedAt} IS NOT NULL`
        )
      );

    const avg = result[0]?.avgHours;
    return avg != null ? Math.round(avg * 10) / 10 : null;
  },

  async countByDateRange(
    startDate: Date,
    endDate: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .where(
        and(
          gte(leaveApprovals.createdAt, startDate),
          lte(leaveApprovals.createdAt, endDate),
          eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED)
        )
      )
      .groupBy(sql`DATE(${leaveApprovals.createdAt})`)
      .orderBy(sql`DATE(${leaveApprovals.createdAt})`);

    return rows;
  },

  async countByDecision(
    decision: LeaveApprovalDecision,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .where(eq(leaveApprovals.decision, decision));
    return Number(result[0]?.count ?? 0);
  },
};

export default leaveApprovalAnalyticsRepository;
