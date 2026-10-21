import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, desc, eq, sql } from "drizzle-orm";

import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveExtensions, leaveRequests } from "@/db";
import { db } from "@/lib/db";

export type LeaveExtension = InferSelectModel<typeof leaveExtensions>;
export type NewLeaveExtension = InferInsertModel<typeof leaveExtensions>;

type LeaveExtensionDbClient = Pick<typeof db, "insert" | "select" | "update">;

export const leaveExtensionRepository = {
  async create(
    input: NewLeaveExtension,
    dbClient: LeaveExtensionDbClient = db
  ): Promise<LeaveExtension> {
    const rows = await dbClient
      .insert(leaveExtensions)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveExtension | null> {
    const rows = await dbClient
      .select()
      .from(leaveExtensions)
      .where(eq(leaveExtensions.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findByIdForUpdate(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveExtension | null> {
    const rows = await dbClient
      .select()
      .from(leaveExtensions)
      .where(eq(leaveExtensions.id, id))
      .limit(1)
      .for("update");

    return rows[0] ?? null;
  },

  async findByIdWithLeave(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<(LeaveExtension & { leaveRequest: typeof leaveRequests.$inferSelect | null }) | null> {
    const rows = await dbClient
      .select({
        extension: leaveExtensions,
        leaveRequest: leaveRequests,
      })
      .from(leaveExtensions)
      .leftJoin(leaveRequests, eq(leaveExtensions.leaveRequestId, leaveRequests.id))
      .where(eq(leaveExtensions.id, id))
      .limit(1);

    if (!rows[0]) return null;

    return {
      ...rows[0].extension,
      leaveRequest: rows[0].leaveRequest,
    };
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveExtension[]> {
    const rows = await dbClient
      .select()
      .from(leaveExtensions)
      .where(eq(leaveExtensions.leaveRequestId, leaveRequestId))
      .orderBy(desc(leaveExtensions.extensionNumber));

    return rows;
  },

  async findByLeaveRequestIdPaginated(
    leaveRequestId: string,
    page: number,
    limit: number,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<{ items: LeaveExtension[]; total: number; page: number; limit: number; totalPages: number }> {
    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(leaveExtensions)
      .where(eq(leaveExtensions.leaveRequestId, leaveRequestId));

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / limit);

    const rows = await dbClient
      .select()
      .from(leaveExtensions)
      .where(eq(leaveExtensions.leaveRequestId, leaveRequestId))
      .orderBy(desc(leaveExtensions.extensionNumber))
      .offset((page - 1) * limit)
      .limit(limit);

    return {
      items: rows,
      total,
      page,
      limit,
      totalPages,
    };
  },

  async findLatestByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveExtension | null> {
    const rows = await dbClient
      .select()
      .from(leaveExtensions)
      .where(eq(leaveExtensions.leaveRequestId, leaveRequestId))
      .orderBy(desc(leaveExtensions.extensionNumber))
      .limit(1);

    return rows[0] ?? null;
  },

  async getNextExtensionNumber(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const result = await dbClient
      .select({
        maxNum: sql<number>`COALESCE(MAX(${leaveExtensions.extensionNumber}), 0)`,
      })
      .from(leaveExtensions)
      .where(eq(leaveExtensions.leaveRequestId, leaveRequestId));

    return (result[0]?.maxNum ?? 0) + 1;
  },

  async updateById(
    id: string,
    values: Partial<NewLeaveExtension>,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveExtension | null> {
    const rows = await dbClient
      .update(leaveExtensions)
      .set(values)
      .where(eq(leaveExtensions.id, id))
      .returning();

    return rows[0] ?? null;
  },

  /**
   * Cancels extensions still awaiting a decision when their parent leave is
   * cancelled. Approved/rejected extensions are history and stay untouched.
   */
  async cancelPendingByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveExtension[]> {
    const rows = await dbClient
      .update(leaveExtensions)
      .set({
        status: LEAVE_REQUEST_STATUS.CANCELLED,
        currentStepKey: null,
        currentStepOrder: null,
      })
      .where(
        and(
          eq(leaveExtensions.leaveRequestId, leaveRequestId),
          eq(leaveExtensions.status, LEAVE_REQUEST_STATUS.PENDING)
        )
      )
      .returning();

    return rows;
  },

  async updateCurrentStep(
    id: string,
    currentStepKey: string | null,
    currentStepOrder: number | null,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<LeaveExtension | null> {
    const rows = await dbClient
      .update(leaveExtensions)
      .set({ currentStepKey, currentStepOrder })
      .where(eq(leaveExtensions.id, id))
      .returning();

    return rows[0] ?? null;
  },
};

export default leaveExtensionRepository;
