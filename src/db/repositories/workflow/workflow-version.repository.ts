import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { desc, eq, sql } from "drizzle-orm";

import { workflowVersions } from "@/db";
import { db } from "@/lib/db";

export type WorkflowVersion = InferSelectModel<typeof workflowVersions>;

export type NewWorkflowVersion = InferInsertModel<
  typeof workflowVersions
>;

type VersionDbClient = Pick<typeof db, "select" | "insert">;

export const workflowVersionRepository = {
  async create(
    input: NewWorkflowVersion,
    dbClient: VersionDbClient = db
  ): Promise<WorkflowVersion> {
    const rows = await dbClient
      .insert(workflowVersions)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findLatestByWorkflowDefinitionId(
    workflowDefinitionId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<WorkflowVersion | null> {
    const rows = await dbClient
      .select()
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowDefinitionId, workflowDefinitionId))
      .orderBy(desc(workflowVersions.version))
      .limit(1);

    return rows[0] ?? null;
  },

  async nextVersion(
    workflowDefinitionId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const rows = await dbClient
      .select({
        maxVersion: sql<number>`
          COALESCE(MAX(${workflowVersions.version}), 0) + 1
        `,
      })
      .from(workflowVersions)
      .where(eq(workflowVersions.workflowDefinitionId, workflowDefinitionId));

    return Number(rows[0]?.maxVersion ?? 1);
  },
};

export default workflowVersionRepository;