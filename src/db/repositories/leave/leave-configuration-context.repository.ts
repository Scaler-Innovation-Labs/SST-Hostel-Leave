import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { leaveConfigurationContexts } from "@/db";
import { db } from "@/lib/db";

export type LeaveConfigurationContext = InferSelectModel<
  typeof leaveConfigurationContexts
>;

export type NewLeaveConfigurationContext = InferInsertModel<
  typeof leaveConfigurationContexts
>;

type ContextDbClient = Pick<typeof db, "select" | "insert">;

export const leaveConfigurationContextRepository = {
  async create(
    input: NewLeaveConfigurationContext,
    dbClient: ContextDbClient = db
  ): Promise<LeaveConfigurationContext> {
    const rows = await dbClient
      .insert(leaveConfigurationContexts)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveConfigurationContext | null> {
    const rows = await dbClient
      .select()
      .from(leaveConfigurationContexts)
      .where(eq(leaveConfigurationContexts.leaveRequestId, leaveRequestId))
      .limit(1);

    return rows[0] ?? null;
  },
};

export default leaveConfigurationContextRepository;