import type { InferSelectModel } from "drizzle-orm";
import { and, eq, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import {
  hostels,
  leaveApprovalParentDetails,
  leaveApprovals,
  leaveExtensions,
  leaveRequests,
  leaveTypes,
  roles,
  students,
  users,
} from "@/db";

const actedByUser = alias(users, "acted_by_user");
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
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
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
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
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

  /**
   * Counts unique leave requests currently awaiting decision at their current workflow step.
   * Excludes extensions, future/inactive approval steps, and non-pending leaves.
   */
  async countActionablePendingLeaves(
    options: { hostelIds?: string[] } = {},
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
      sql`${leaveApprovals.leaveExtensionId} IS NULL`,
      eq(leaveRequests.status, LEAVE_REQUEST_STATUS.PENDING),
      eq(leaveApprovals.stepOrder, leaveRequests.currentStepOrder),
      eq(leaveApprovals.stepKey, leaveRequests.currentStepKey),
    ];
    conditions.push(...hostelCondition(options.hostelIds));

    const result = await dbClient
      .select({
        count: sql<number>`count(distinct ${leaveApprovals.leaveRequestId})`,
      })
      .from(leaveApprovals)
      .innerJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  },

  /**
   * Counts unique leave extensions currently awaiting decision at their current workflow step.
   * Excludes primary leaves, future/inactive approval steps, and non-pending extensions.
   */
  async countActionablePendingExtensions(
    options: { hostelIds?: string[] } = {},
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
      sql`${leaveApprovals.leaveExtensionId} IS NOT NULL`,
      eq(leaveExtensions.status, LEAVE_REQUEST_STATUS.PENDING),
      eq(leaveApprovals.stepOrder, leaveExtensions.currentStepOrder),
      eq(leaveApprovals.stepKey, leaveExtensions.currentStepKey),
    ];
    conditions.push(...hostelCondition(options.hostelIds));

    const result = await dbClient
      .select({
        count: sql<number>`count(distinct ${leaveApprovals.leaveExtensionId})`,
      })
      .from(leaveApprovals)
      .innerJoin(leaveExtensions, eq(leaveApprovals.leaveExtensionId, leaveExtensions.id))
      .innerJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  },

  async countPendingStats(
    options: { hostelIds?: string[] } = {},
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    pendingLeaves: number;
    pendingExtensions: number;
  }> {
    const [pendingLeaves, pendingExtensions] = await Promise.all([
      this.countActionablePendingLeaves(options, dbClient),
      this.countActionablePendingExtensions(options, dbClient),
    ]);

    return {
      pendingLeaves,
      pendingExtensions,
    };
  },

  async staffDecisionsSummary(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{
    totalDecisions: number;
    totalApproved: number;
    totalRejected: number;
    activeApproversCount: number;
    averageTurnaroundHours: number | null;
  }> {
    const conditions: ReturnType<typeof and>[] = [
      isNull(leaveApprovalParentDetails.approvalId),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
      inArray(leaveApprovals.decision, [
        LEAVE_APPROVAL_DECISION.APPROVED,
        LEAVE_APPROVAL_DECISION.REJECTED,
      ]),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const result = await dbClient
      .select({
        totalDecisions: sql<number>`count(*)`,
        totalApproved: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.APPROVED})`,
        totalRejected: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.REJECTED})`,
        activeApproversCount: sql<number>`count(distinct ${leaveApprovals.actedByUserId}) filter (where ${leaveApprovals.actedByUserId} is not null)`,
        avgHours: sql<number | null>`avg(extract(epoch from (${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600)`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    const row = result[0];
    const avg = row?.avgHours != null ? Number(row.avgHours) : null;
    return {
      totalDecisions: Number(row?.totalDecisions ?? 0),
      totalApproved: Number(row?.totalApproved ?? 0),
      totalRejected: Number(row?.totalRejected ?? 0),
      activeApproversCount: Number(row?.activeApproversCount ?? 0),
      averageTurnaroundHours: avg != null ? Math.round(avg * 10) / 10 : null,
    };
  },

  async staffPendingCount(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      isNull(leaveApprovalParentDetails.approvalId),
      eq(leaveApprovals.decision, LEAVE_APPROVAL_DECISION.PENDING),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveApprovals)
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));

    return Number(result[0]?.count ?? 0);
  },

  async staffActivityTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; approved: number; rejected: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      isNull(leaveApprovalParentDetails.approvalId),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
      inArray(leaveApprovals.decision, [
        LEAVE_APPROVAL_DECISION.APPROVED,
        LEAVE_APPROVAL_DECISION.REJECTED,
      ]),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${leaveApprovals.actedAt})`,
        approved: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.APPROVED})`,
        rejected: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.REJECTED})`,
      })
      .from(leaveApprovals)
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${leaveApprovals.actedAt})`)
      .orderBy(sql`DATE(${leaveApprovals.actedAt})`);

    return rows.map((r) => ({
      date: String(r.date),
      approved: Number(r.approved ?? 0),
      rejected: Number(r.rejected ?? 0),
    }));
  },

  async staffDecisionsByRole(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{
    role: string;
    approvedCount: number;
    rejectedCount: number;
    totalDecisions: number;
    averageTurnaroundHours: number | null;
  }>> {
    const conditions: ReturnType<typeof and>[] = [
      isNull(leaveApprovalParentDetails.approvalId),
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
      inArray(leaveApprovals.decision, [
        LEAVE_APPROVAL_DECISION.APPROVED,
        LEAVE_APPROVAL_DECISION.REJECTED,
      ]),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const rows = await dbClient
      .select({
        roleName: sql<string>`COALESCE(${roles.name}, ${roles.code}, ${leaveApprovals.stepKey})`,
        approved: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.APPROVED})`,
        rejected: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.REJECTED})`,
        total: sql<number>`count(*)`,
        avgHours: sql<number | null>`avg(extract(epoch from (${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600)`,
      })
      .from(leaveApprovals)
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`COALESCE(${roles.name}, ${roles.code}, ${leaveApprovals.stepKey})`)
      .orderBy(sql`count(*) desc`);

    return rows.map((r) => {
      const avg = r.avgHours != null ? Number(r.avgHours) : null;
      return {
        role: r.roleName,
        approvedCount: Number(r.approved ?? 0),
        rejectedCount: Number(r.rejected ?? 0),
        totalDecisions: Number(r.total ?? 0),
        averageTurnaroundHours: avg != null ? Math.round(avg * 10) / 10 : null,
      };
    });
  },

  async staffApproverBreakdown(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{
    userId: string;
    name: string;
    role: string;
    approvedCount: number;
    rejectedCount: number;
    totalDecisions: number;
    averageTurnaroundHours: number | null;
  }>> {
    const conditions: ReturnType<typeof and>[] = [
      isNull(leaveApprovalParentDetails.approvalId),
      sql`${leaveApprovals.actedByUserId} IS NOT NULL`,
      sql`${leaveApprovals.actedAt} IS NOT NULL`,
      inArray(leaveApprovals.decision, [
        LEAVE_APPROVAL_DECISION.APPROVED,
        LEAVE_APPROVAL_DECISION.REJECTED,
      ]),
      gte(leaveApprovals.actedAt, startDate),
      lte(leaveApprovals.actedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));

    const rows = await dbClient
      .select({
        userId: leaveApprovals.actedByUserId,
        name: sql<string>`COALESCE(${actedByUser.fullName}, 'Staff Member')`,
        role: sql<string>`COALESCE(${roles.name}, ${roles.code}, 'Staff')`,
        approved: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.APPROVED})`,
        rejected: sql<number>`count(*) filter (where ${leaveApprovals.decision} = ${LEAVE_APPROVAL_DECISION.REJECTED})`,
        total: sql<number>`count(*)`,
        avgHours: sql<number | null>`avg(extract(epoch from (${leaveApprovals.actedAt} - ${leaveApprovals.createdAt})) / 3600)`,
      })
      .from(leaveApprovals)
      .leftJoin(
        leaveApprovalParentDetails,
        eq(leaveApprovals.id, leaveApprovalParentDetails.approvalId)
      )
      .leftJoin(actedByUser, eq(leaveApprovals.actedByUserId, actedByUser.id))
      .leftJoin(roles, eq(leaveApprovals.approverRoleId, roles.id))
      .leftJoin(leaveRequests, eq(leaveApprovals.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(
        leaveApprovals.actedByUserId,
        actedByUser.fullName,
        sql`COALESCE(${roles.name}, ${roles.code}, 'Staff')`
      )
      .orderBy(sql`count(*) desc`);

    return rows.map((r) => {
      const avg = r.avgHours != null ? Number(r.avgHours) : null;
      return {
        userId: r.userId ?? "",
        name: r.name,
        role: r.role,
        approvedCount: Number(r.approved ?? 0),
        rejectedCount: Number(r.rejected ?? 0),
        totalDecisions: Number(r.total ?? 0),
        averageTurnaroundHours: avg != null ? Math.round(avg * 10) / 10 : null,
      };
    });
  },
};

export default leaveApprovalAnalyticsRepository;
