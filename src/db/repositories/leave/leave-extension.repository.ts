import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { desc, eq, sql } from "drizzle-orm";

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
