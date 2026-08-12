import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { academicGroups, departments, hostels, leaveApprovals, leaveRequests, students, users } from "@/db";
import { db } from "@/lib/db";

function hostelCondition(hostelIds?: string[]): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(users.hostelId, hostelIds));
  }
  return conditions;
}

export const leaveAnalyticsRepository = {
  async statusBreakdown(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ status: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        status: leaveRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(leaveRequests.status)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ status: row.status, count: Number(row.count ?? 0) }));
  },

  async countByHostel(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        name: hostels.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
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

  async countByDepartment(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        name: departments.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .innerJoin(students, eq(leaveRequests.studentId, students.id))
      .innerJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .innerJoin(departments, eq(academicGroups.departmentId, departments.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(departments.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },

  async durationDistribution(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ bucket: string; count: number }>> {
    const durationDays = sql`EXTRACT(EPOCH FROM (${leaveRequests.endAt} - ${leaveRequests.startAt})) / 86400`;
    const bucket = sql<string>`CASE
      WHEN ${durationDays} <= 1 THEN '0-1 day'
      WHEN ${durationDays} <= 3 THEN '1-3 days'
      WHEN ${durationDays} <= 7 THEN '4-7 days'
      ELSE '8+ days'
    END`;

    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        bucket,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(bucket)
      .orderBy(sql`min(${leaveRequests.startAt})`);

    return rows.map((row) => ({ bucket: row.bucket, count: Number(row.count ?? 0) }));
  },

  async trendByStatus(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; status: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(leaveRequests.createdAt, startDate),
      lte(leaveRequests.createdAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveRequests.createdAt})`,
        status: leaveRequests.status,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveRequests.createdAt})`, leaveRequests.status)
      .orderBy(sql`DATE(${leaveRequests.createdAt})`);

    return rows.map((row) => ({ date: row.date, status: row.status, count: Number(row.count ?? 0) }));
  },

  async approvalTimeTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; avgHours: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.APPROVED),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.actedAt})`,
        avgHours: sql<number>`EXTRACT(EPOCH FROM AVG(${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveApprovals.actedAt})`)
      .orderBy(sql`DATE(${leaveApprovals.actedAt})`);

    return rows.map((row) => ({
      date: row.date,
      avgHours: Number(Number(row.avgHours ?? 0).toFixed(1)),
    }));
  },
};

export default leaveAnalyticsRepository;