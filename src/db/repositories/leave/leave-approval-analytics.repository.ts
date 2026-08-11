import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { leaveApprovals, leaveRequests, students, users } from "@/db";
import { db } from "@/lib/db";

export type LeaveApproval = InferSelectModel<typeof leaveApprovals>;

function hostelCondition(hostelIds?: string[]): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(users.hostelId, hostelIds));
  }
  return conditions;
}

export const leaveApprovalAnalyticsRepository = {
  async countRecent(
    since: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [gte(leaveApprovals.createdAt, since)];
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  },

  async averageApprovalTime(
    since: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number | null> {
    const conditions: ReturnType<typeof and>[] = [
      gte(leaveApprovals.createdAt, since),
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
    ];
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({
        avgHours: sql<number>`EXTRACT(EPOCH FROM AVG(${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    const avg = result[0]?.avgHours;
    return avg != null ? Math.round(avg * 10) / 10 : null;
  },

  async countByDateRange(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(leaveApprovals.createdAt, startDate),
      lte(leaveApprovals.createdAt, endDate),
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveApprovals.createdAt})`)
      .orderBy(sql`DATE(${leaveApprovals.createdAt})`);

    return rows;
  },

  async countByDecision(
    decision: LeaveApprovalDecision,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [eq(leaveApprovals.decision, decision)];
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },
};

export default leaveApprovalAnalyticsRepository;
