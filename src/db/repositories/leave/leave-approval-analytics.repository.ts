import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { hostels, leaveApprovals, leaveRequests, leaveTypes, students, users } from "@/db";
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

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
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

  async countPendingByType(
    decision: LeaveApprovalDecision,
    options: { extensionOnly?: boolean; hostelIds?: string[] },
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [eq(leaveApprovals.decision, decision)];
    conditions.push(...hostelCondition(options.hostelIds));
    if (options.extensionOnly) {
      conditions.push(sql`${leaveApprovals.leaveExtensionId} IS NOT NULL`);
    } else {
      conditions.push(sql`${leaveApprovals.leaveExtensionId} IS NULL`);
    }
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async countRejections(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
    ];
    if (startDate) conditions.push(gte(leaveApprovals.actedAt, startDate));
    if (endDate) conditions.push(lte(leaveApprovals.actedAt, endDate));
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

  async rejectionsByStepKey(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ stepKey: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
    ];
    if (startDate) conditions.push(gte(leaveApprovals.actedAt, startDate));
    if (endDate) conditions.push(lte(leaveApprovals.actedAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        stepKey: leaveApprovals.stepKey,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(leaveApprovals.stepKey)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ stepKey: row.stepKey, count: Number(row.count ?? 0) }));
  },

  async rejectionsByCategory(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ category: string | null; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
      sql`${leaveApprovals.rejectionCategory} IS NOT NULL`,
    ];
    if (startDate) conditions.push(gte(leaveApprovals.actedAt, startDate));
    if (endDate) conditions.push(lte(leaveApprovals.actedAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        category: leaveApprovals.rejectionCategory,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(leaveApprovals.rejectionCategory)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ category: row.category, count: Number(row.count ?? 0) }));
  },

  async rejectionsTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.actedAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveApprovals.actedAt})`)
      .orderBy(sql`DATE(${leaveApprovals.actedAt})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },

  async rejectionsByHostel(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
    ];
    if (startDate) conditions.push(gte(leaveApprovals.actedAt, startDate));
    if (endDate) conditions.push(lte(leaveApprovals.actedAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        name: hostels.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(users.hostelId, hostels.id))
      .where(and(...conditions))
      .groupBy(hostels.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },

  async rejectionsByLeaveType(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.REJECTED),
    ];
    if (startDate) conditions.push(gte(leaveApprovals.actedAt, startDate));
    if (endDate) conditions.push(lte(leaveApprovals.actedAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        name: leaveTypes.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(leaveTypes.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unknown",
      count: Number(row.count ?? 0),
    }));
  },
};

export default leaveApprovalAnalyticsRepository;
