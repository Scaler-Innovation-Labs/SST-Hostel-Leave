import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { leaveExecutionContexts } from "@/db";
import { db } from "@/lib/db";

export type LeaveExecutionContext = InferSelectModel<
  typeof leaveExecutionContexts
>;

export type NewLeaveExecutionContext = InferInsertModel<
  typeof leaveExecutionContexts
>;

type ContextDbClient = Pick<typeof db, "select" | "insert">;

export const leaveExecutionContextRepository = {
  async create(
    input: NewLeaveExecutionContext,
    dbClient: ContextDbClient = db
  ): Promise<LeaveExecutionContext> {
    const rows = await dbClient
      .insert(leaveExecutionContexts)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveExecutionContext | null> {
    const rows = await dbClient
      .select()
      .from(leaveExecutionContexts)
      .where(eq(leaveExecutionContexts.leaveRequestId, leaveRequestId))
      .limit(1);

    return rows[0] ?? null;
  },
};

export default leaveExecutionContextRepository;