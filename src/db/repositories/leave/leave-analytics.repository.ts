import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { QR_STATUS } from "@/constants/movement/qr-status";
import {
  academicGroups,
  departments,
  hostels,
  leaveApprovals,
  leaveExtensions,
  leaveRequests,
  leaveTypes,
  qrPasses,
  students,
  users,
} from "@/db";
import { db } from "@/lib/db";

function expiredLeaveTimestamp() {
  return sql`COALESCE(${leaveRequests.expiredAt}, ${leaveRequests.updatedAt})`;
}

function expiredLeaveConditions(
  hostelIds?: string[],
  startDate?: Date,
  endDate?: Date
): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [
    eq(leaveRequests.status, LEAVE_REQUEST_STATUS.EXPIRED),
  ];
  if (hostelIds?.length) {
    conditions.push(inArray(leaveRequests.hostelId, hostelIds));
  }
  const ts = expiredLeaveTimestamp();
  if (startDate) {
    conditions.push(sql`${ts} >= ${startDate}`);
  }
  if (endDate) {
    conditions.push(sql`${ts} <= ${endDate}`);
  }
  return conditions;
}

function leaveConditions(
  hostelIds?: string[],
  startDate?: Date,
  endDate?: Date
): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(leaveRequests.hostelId, hostelIds));
  }
  if (startDate) {
    conditions.push(gte(leaveRequests.createdAt, startDate));
  }
  if (endDate) {
    conditions.push(lte(leaveRequests.createdAt, endDate));
  }
  return conditions;
}

export const leaveAnalyticsRepository = {
  async statusBreakdown(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ status: string; count: number }>> {
    const conditions = leaveConditions(hostelIds, startDate, endDate);
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
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = leaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        name: sql<string>`COALESCE(${leaveRequests.hostelName}, 'Unassigned')`,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .leftJoin(hostels, eq(leaveRequests.hostelId, hostels.id))
      .where(and(...conditions))
      .groupBy(sql`COALESCE(${leaveRequests.hostelName}, 'Unassigned')`)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },

  async countByDepartment(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = leaveConditions(hostelIds, startDate, endDate);
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
    dbClient: Pick<typeof db, "select"> = db,
    startDate?: Date,
    endDate?: Date
  ): Promise<Array<{ bucket: string; count: number }>> {
    const durationDays = sql`EXTRACT(EPOCH FROM (${leaveRequests.endAt} - ${leaveRequests.startAt})) / 86400`;
    const bucket = sql<string>`CASE
      WHEN ${durationDays} <= 1 THEN '0-1 day'
      WHEN ${durationDays} <= 3 THEN '1-3 days'
      WHEN ${durationDays} <= 7 THEN '4-7 days'
      ELSE '8+ days'
    END`;

    const conditions = leaveConditions(hostelIds, startDate, endDate);
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
    conditions.push(...leaveConditions(hostelIds));
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
    conditions.push(...leaveConditions(hostelIds));
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

  async countExpiredLeaves(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequests)
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async countExpiredExtensions(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveExtensions.status, LEAVE_REQUEST_STATUS.EXPIRED),
    ];
    if (hostelIds?.length) {
      conditions.push(inArray(leaveRequests.hostelId, hostelIds));
    }
    if (startDate) {
      conditions.push(gte(leaveExtensions.updatedAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(leaveExtensions.updatedAt, endDate));
    }
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveExtensions)
      .innerJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async countExpiredQrPasses(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      eq(qrPasses.status, QR_STATUS.EXPIRED),
    ];
    if (hostelIds?.length) {
      conditions.push(inArray(users.hostelId, hostelIds));
    }
    const ts = sql`COALESCE(${qrPasses.expiresAt}, ${qrPasses.createdAt})`;
    if (startDate) {
      conditions.push(sql`${ts} >= ${startDate}`);
    }
    if (endDate) {
      conditions.push(sql`${ts} <= ${endDate}`);
    }
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(qrPasses)
      .leftJoin(students, eq(qrPasses.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },

  async expiredTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const ts = expiredLeaveTimestamp();
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${ts})`,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .groupBy(sql`DATE(${ts})`)
      .orderBy(sql`DATE(${ts})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },

  async expiredByLeaveType(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number; color: string | null }>> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        name: leaveTypes.name,
        count: sql<number>`count(*)`,
        uiConfig: leaveTypes.uiConfig,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .where(and(...conditions))
      .groupBy(leaveTypes.id, leaveTypes.name, leaveTypes.uiConfig)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => {
      const uiConfig = row.uiConfig as { color?: string } | null;
      return {
        name: row.name,
        count: Number(row.count ?? 0),
        color: typeof uiConfig?.color === "string" ? uiConfig.color : null,
      };
    });
  },

  async expiredByPendingStep(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ stepKey: string | null; count: number }>> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        stepKey: leaveRequests.currentStepKey,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .groupBy(leaveRequests.currentStepKey)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      stepKey: row.stepKey,
      count: Number(row.count ?? 0),
    }));
  },

  async expiredByReason(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const expiredTs = expiredLeaveTimestamp();
    const reasonExpr = sql<string>`CASE
      WHEN ${leaveRequests.approvedAt} IS NOT NULL THEN 'Approved — QR Not Scanned / Didn''t Leave'
      WHEN EXISTS (
        SELECT 1
        FROM leave_approvals la
        JOIN leave_approval_parent_details lapd ON lapd.approval_id = la.id
        WHERE la.leave_request_id = ${leaveRequests.id}
          AND la.step_key = 'PARENT_APPROVAL'
          AND la.decision = 'CANCELLED'
          AND lapd.token_expires_at IS NOT NULL
          AND lapd.token_expires_at <= ${expiredTs}
      ) THEN 'Parent Approval Link Expired'
      WHEN EXISTS (
        SELECT 1 FROM leave_approvals la
        WHERE la.leave_request_id = ${leaveRequests.id}
          AND la.step_key = 'ADMIN_APPROVAL'
          AND la.decision = 'CANCELLED'
      ) AND NOT EXISTS (
        SELECT 1 FROM leave_approvals la
        WHERE la.leave_request_id = ${leaveRequests.id}
          AND la.step_key IN ('PARENT_APPROVAL', 'POC_APPROVAL')
          AND la.decision = 'CANCELLED'
      ) THEN 'Pending Admin Approval (Window Ended)'
      WHEN EXISTS (
        SELECT 1 FROM leave_approvals la
        WHERE la.leave_request_id = ${leaveRequests.id}
          AND la.step_key = 'POC_APPROVAL'
          AND la.decision = 'CANCELLED'
      ) AND NOT EXISTS (
        SELECT 1 FROM leave_approvals la
        WHERE la.leave_request_id = ${leaveRequests.id}
          AND la.step_key = 'PARENT_APPROVAL'
          AND la.decision = 'CANCELLED'
      ) THEN 'Pending POC Approval (Window Ended)'
      ELSE 'Pending Parent Approval (Window Ended)'
    END`;

    const rows = await dbClient
      .select({
        name: reasonExpr,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .groupBy(sql`1`)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unknown",
      count: Number(row.count ?? 0),
    }));
  },

  async expiredByHostel(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        name: sql<string>`COALESCE(${leaveRequests.hostelName}, 'Unassigned')`,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .where(and(...conditions))
      .groupBy(sql`COALESCE(${leaveRequests.hostelName}, 'Unassigned')`)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },

  async expiredByDepartment(
    hostelIds?: string[],
    startDate?: Date,
    endDate?: Date,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = expiredLeaveConditions(hostelIds, startDate, endDate);
    const rows = await dbClient
      .select({
        name: departments.name,
        count: sql<number>`count(*)`,
      })
      .from(leaveRequests)
      .innerJoin(students, eq(leaveRequests.studentId, students.id))
      .innerJoin(academicGroups, eq(students.academicGroupId, academicGroups.id))
      .innerJoin(departments, eq(academicGroups.departmentId, departments.id))
      .where(and(...conditions))
      .groupBy(departments.name)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({
      name: row.name ?? "Unassigned",
      count: Number(row.count ?? 0),
    }));
  },
};

export default leaveAnalyticsRepository;