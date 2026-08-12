import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { academicGroups, departments, hostels, students, users } from "@/db";
import { db } from "@/lib/db";

function hostelCondition(hostelIds?: string[]): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(users.hostelId, hostelIds));
  }
  return conditions;
}

export const studentAnalyticsRepository = {
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
      .from(students)
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
      .from(students)
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

  async countByAcademicGroup(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        name: academicGroups.name,
        count: sql<number>`count(*)`,
      })
      .from(students)
      .innerJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(academicGroups.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },

  async countByGender(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        name: users.gender,
        count: sql<number>`count(*)`,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(users.gender)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "UNKNOWN",
      count: Number(row.count ?? 0),
    }));
  },

  async trendByDateRange(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(students.createdAt, startDate),
      lte(students.createdAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${students.createdAt})`,
        count: sql<number>`count(*)`,
      })
      .from(students)
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${students.createdAt})`)
      .orderBy(sql`DATE(${students.createdAt})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },
};

export default studentAnalyticsRepository;