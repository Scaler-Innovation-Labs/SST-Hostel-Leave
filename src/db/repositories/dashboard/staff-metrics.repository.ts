import { sql } from "drizzle-orm";

import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { db } from "@/lib/db";

export type LocationAndUserStats = {
  total: number;
  active: number;
  inHostel: number;
  outsideHostel: number;
  overdue: number;
  totalUsers: number;
};

/**
 * Combines student location statistics and total user counts into a single atomic SQL query.
 * Uses CTEs to guarantee that:
 * 1. user counts and student counts are computed independently without cross-join multiplication.
 * 2. hostel-scoping is properly applied to both CTEs when hostelIds are provided.
 * 3. empty datasets always return exactly 1 row of zeros (no nulls or empty sets).
 */
export const staffMetricsRepository = {
  async getLocationAndUserStats(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "execute"> = db
  ): Promise<LocationAndUserStats> {
    const hasHostels = Boolean(hostelIds && hostelIds.length > 0);
    const hostelIdsList =
      hostelIds && hostelIds.length > 0
        ? sql.join(
            hostelIds.map((id) => sql`${id}`),
            sql`, `
          )
        : sql``;

    const userWhere = hasHostels
      ? sql`WHERE users.hostel_id IN (${hostelIdsList})`
      : sql``;

    const studentWhere = hasHostels
      ? sql`WHERE u.hostel_id IN (${hostelIdsList})`
      : sql``;

    const query = sql`
      WITH user_stat AS (
        SELECT count(*)::int AS total_users
        FROM users
        ${userWhere}
      ),
      student_stat AS (
        SELECT
          count(*)::int AS total_students,
          count(*) FILTER (WHERE u.is_active IS TRUE)::int AS active_students,
          count(*) FILTER (WHERE s.current_location_state = ${MOVEMENT_STATE.IN_HOSTEL})::int AS in_hostel,
          count(*) FILTER (WHERE s.current_location_state = ${MOVEMENT_STATE.OUTSIDE_HOSTEL})::int AS outside_hostel,
          count(*) FILTER (WHERE s.current_location_state = ${MOVEMENT_STATE.OVERDUE})::int AS overdue
        FROM students s
        LEFT JOIN users u ON s.user_id = u.id
        ${studentWhere}
      )
      SELECT
        user_stat.total_users AS "totalUsers",
        student_stat.total_students AS "total",
        student_stat.active_students AS "active",
        student_stat.in_hostel AS "inHostel",
        student_stat.outside_hostel AS "outsideHostel",
        student_stat.overdue AS "overdue"
      FROM user_stat, student_stat
    `;

    const result = await dbClient.execute(query);
    const row = ((result.rows as Array<Record<string, unknown>> | undefined)?.[0] ?? {}) as Record<string, unknown>;

    return {
      total: Number(row.total ?? 0),
      active: Number(row.active ?? 0),
      inHostel: Number(row.inHostel ?? 0),
      outsideHostel: Number(row.outsideHostel ?? 0),
      overdue: Number(row.overdue ?? 0),
      totalUsers: Number(row.totalUsers ?? 0),
    };
  },
};
