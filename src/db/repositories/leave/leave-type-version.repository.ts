import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { desc, eq, sql } from "drizzle-orm";

import { leaveTypeVersions } from "@/db";
import { db } from "@/lib/db";

export type LeaveTypeVersion = InferSelectModel<typeof leaveTypeVersions>;

export type NewLeaveTypeVersion = InferInsertModel<
  typeof leaveTypeVersions
>;

type VersionDbClient = Pick<typeof db, "select" | "insert">;

export const leaveTypeVersionRepository = {
  async create(
    input: NewLeaveTypeVersion,
    dbClient: VersionDbClient = db
  ): Promise<LeaveTypeVersion> {
    const rows = await dbClient
      .insert(leaveTypeVersions)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findLatestByLeaveTypeId(
    leaveTypeId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<LeaveTypeVersion | null> {
    const rows = await dbClient
      .select()
      .from(leaveTypeVersions)
      .where(eq(leaveTypeVersions.leaveTypeId, leaveTypeId))
      .orderBy(desc(leaveTypeVersions.version))
      .limit(1);

    return rows[0] ?? null;
  },

  async nextVersion(
    leaveTypeId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const rows = await dbClient
      .select({
        maxVersion: sql<number>`
          COALESCE(MAX(${leaveTypeVersions.version}), 0) + 1
        `,
      })
      .from(leaveTypeVersions)
      .where(eq(leaveTypeVersions.leaveTypeId, leaveTypeId));

    return Number(rows[0]?.maxVersion ?? 1);
  },
};

export default leaveTypeVersionRepository;