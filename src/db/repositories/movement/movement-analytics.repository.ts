import { and, eq, gte, inArray, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";

import type { MovementEvent } from "@/constants/movement/movement-event";
import { QR_SCAN_RESULT } from "@/constants/movement/qr-scan-result";
import { leaveRequests, movementEvents, qrPasses, qrScanLogs, students, users } from "@/db";
import { db } from "@/lib/db";

function hostelCondition(hostelIds?: string[]): ReturnType<typeof and>[] {
  const conditions: ReturnType<typeof and>[] = [];
  if (hostelIds?.length) {
    conditions.push(inArray(users.hostelId, hostelIds));
  }
  return conditions;
}

export const movementAnalyticsRepository = {
  async countByEventType(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(movementEvents.occurredAt, startDate),
      lte(movementEvents.occurredAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        name: movementEvents.eventType,
        count: sql<number>`count(*)`,
      })
      .from(movementEvents)
      .leftJoin(students, eq(movementEvents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(movementEvents.eventType)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ name: row.name, count: Number(row.count ?? 0) }));
  },

  async countByMovementMethod(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(movementEvents.occurredAt, startDate),
      lte(movementEvents.occurredAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        name: movementEvents.movementMethod,
        count: sql<number>`count(*)`,
      })
      .from(movementEvents)
      .leftJoin(students, eq(movementEvents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(movementEvents.movementMethod)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ name: row.name, count: Number(row.count ?? 0) }));
  },

  async trendByDateRange(
    startDate: Date,
    endDate: Date,
    eventType?: MovementEvent,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(movementEvents.occurredAt, startDate),
      lte(movementEvents.occurredAt, endDate),
    ];
    if (eventType) {
      conditions.push(eq(movementEvents.eventType, eventType));
    }
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${movementEvents.occurredAt})`,
        count: sql<number>`count(*)`,
      })
      .from(movementEvents)
      .leftJoin(students, eq(movementEvents.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${movementEvents.occurredAt})`)
      .orderBy(sql`DATE(${movementEvents.occurredAt})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },

  async qrByStatus(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ name: string; count: number }>> {
    const conditions = hostelCondition(hostelIds);
    const rows = await dbClient
      .select({
        name: qrPasses.status,
        count: sql<number>`count(*)`,
      })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(qrPasses.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(qrPasses.status)
      .orderBy(sql`count(*) desc`);

    return rows.map((row) => ({ name: row.name, count: Number(row.count ?? 0) }));
  },

  async qrTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(qrPasses.generatedAt, startDate),
      lte(qrPasses.generatedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${qrPasses.generatedAt})`,
        count: sql<number>`count(*)`,
      })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(qrPasses.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${qrPasses.generatedAt})`)
      .orderBy(sql`DATE(${qrPasses.generatedAt})`);

    return rows.map((row) => ({ date: row.date, count: Number(row.count ?? 0) }));
  },

  async qrScanByResult(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{ success: number; failed: number }> {
    const conditions: ReturnType<typeof and>[] = [
      gte(qrScanLogs.scannedAt, startDate),
      lte(qrScanLogs.scannedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({
        result: qrScanLogs.scanResult,
        count: sql<number>`count(*)`,
      })
      .from(qrScanLogs)
      .leftJoin(qrPasses, eq(qrScanLogs.qrPassId, qrPasses.id))
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(qrScanLogs.scanResult);

    let success = 0;
    let failed = 0;
    for (const row of result) {
      if (row.result === QR_SCAN_RESULT.SUCCESS) success = Number(row.count ?? 0);
      else if (row.result === QR_SCAN_RESULT.FAILED) failed = Number(row.count ?? 0);
    }
    return { success, failed };
  },

  async qrScanTrend(
    startDate: Date,
    endDate: Date,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ date: string; success: number; failed: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      gte(qrScanLogs.scannedAt, startDate),
      lte(qrScanLogs.scannedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        date: sql<string>`DATE(${qrScanLogs.scannedAt})`,
        result: qrScanLogs.scanResult,
        count: sql<number>`count(*)`,
      })
      .from(qrScanLogs)
      .leftJoin(qrPasses, eq(qrScanLogs.qrPassId, qrPasses.id))
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(sql`DATE(${qrScanLogs.scannedAt})`, qrScanLogs.scanResult)
      .orderBy(sql`DATE(${qrScanLogs.scannedAt})`);

    const byDate = new Map<string, { success: number; failed: number }>();
    for (const row of rows) {
      const entry = byDate.get(row.date) ?? { success: 0, failed: 0 };
      if (row.result === QR_SCAN_RESULT.SUCCESS) entry.success = Number(row.count ?? 0);
      else if (row.result === QR_SCAN_RESULT.FAILED) entry.failed = Number(row.count ?? 0);
      byDate.set(row.date, entry);
    }

    return [...byDate.entries()].map(([date, value]) => ({ date, ...value }));
  },

  async topScanFailureReasons(
    startDate: Date,
    endDate: Date,
    limit: number,
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<{ reason: string; count: number }>> {
    const conditions: ReturnType<typeof and>[] = [
      eq(qrScanLogs.scanResult, QR_SCAN_RESULT.FAILED),
      isNotNull(qrScanLogs.failureReason),
      gte(qrScanLogs.scannedAt, startDate),
      lte(qrScanLogs.scannedAt, endDate),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const rows = await dbClient
      .select({
        reason: qrScanLogs.failureReason,
        count: sql<number>`count(*)`,
      })
      .from(qrScanLogs)
      .leftJoin(qrPasses, eq(qrScanLogs.qrPassId, qrPasses.id))
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(leaveRequests.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions))
      .groupBy(qrScanLogs.failureReason)
      .orderBy(sql`count(*) desc`)
      .limit(limit);

    return rows.map((row) => ({
      reason: row.reason ?? "Unknown",
      count: Number(row.count ?? 0),
    }));
  },

  async countOverdueReturns(
    hostelIds?: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const conditions: ReturnType<typeof and>[] = [
      isNotNull(qrPasses.firstScanAt),
      isNull(qrPasses.closedAt),
      lt(leaveRequests.endAt, new Date()),
    ];
    conditions.push(...hostelCondition(hostelIds));
    const result = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(qrPasses)
      .leftJoin(leaveRequests, eq(qrPasses.leaveRequestId, leaveRequests.id))
      .leftJoin(students, eq(qrPasses.studentId, students.id))
      .leftJoin(users, eq(students.userId, users.id))
      .where(and(...conditions));
    return Number(result[0]?.count ?? 0);
  },
};

export default movementAnalyticsRepository;