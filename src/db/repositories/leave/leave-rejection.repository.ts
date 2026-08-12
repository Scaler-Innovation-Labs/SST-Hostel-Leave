import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { LeaveRejectionSource } from "@/constants/leave/leave-rejection-source";
import { hostels, leaveRejections, leaveTypes, students, users } from "@/db";
import { db } from "@/lib/db";

export type LeaveRejection = InferSelectModel<typeof leaveRejections>;
export type NewLeaveRejection = InferInsertModel<typeof leaveRejections>;

type LeaveRejectionDbClient = Pick<typeof db, "insert" | "select">;

function hostelCondition(hostelIds?: string[]): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(users.hostelId, hostelIds));
  }
  return conditions;
}

export const leaveRejectionRepository = {
  async create(
    input: NewLeaveRejection,
    dbClient: LeaveRejectionDbClient = db
  ): Promise<LeaveRejection> {
    const rows = await dbClient
      .insert(leaveRejections)
      .values(input)
      .returning();
    return rows[0]!;
  },

  async countBySource(
    source: LeaveRejectionSource,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [eq(leaveRejections.rejectionSource, source)];
    if (startDate) conditions.push(gte(leaveRejections.createdAt, startDate));
    if (endDate) conditions.push(lte(leaveRejections.createdAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveRejections)
      .leftJoin(students, eq(leaveRejections.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async trendByDateRange(
    startDate: Date,
    endDate: Date,
    source?: LeaveRejectionSource,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(leaveRejections.createdAt, startDate),
      lte(leaveRejections.createdAt, endDate),
    ];
    if (source) {
      conditions.push(eq(leaveRejections.rejectionSource, source));
    }
    conditions.push(...hostelCondition(hostelIds));

    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveRejections.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveRejections)
      .leftJoin(students, eq(leaveRejections.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveRejections.createdAt})`)
      .orderBy(sql`DATE(${leaveRejections.createdAt})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },

  async countByLeaveType(
    source: LeaveRejectionSource,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [eq(leaveRejections.rejectionSource, source)];
    if (startDate) conditions.push(gte(leaveRejections.createdAt, startDate));
    if (endDate) conditions.push(lte(leaveRejections.createdAt, endDate));
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        name: leaveTypes.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRejections)
      .innerJoin(leaveTypes, eq(leaveRejections.leaveTypeId, leaveTypes.id))
      .leftJoin(students, eq(leaveRejections.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(leaveTypes.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unknown",
      count: Number(row.count ?? 0),
    }));
  },

  async countByHostel(
    source: LeaveRejectionSource,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [eq(leaveRejections.rejectionSource, source)];
    if (startDate) conditions.push(gte(leaveRejections.createdAt, startDate));
    if (endDate) conditions.push(lte(leaveRejections.createdAt, endDate));
    if (hostelIds?.length) {
      // Scoped views show only their own hostels; group still applied for consistency.
      conditions.push(inArray(users.hostelId, hostelIds));
    }
    const rows = await dbClient
      .select({
        name: hostels.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRejections)
      .leftJoin(students, eq(leaveRejections.studentId, students.id))
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
};

export default leaveRejectionRepository;