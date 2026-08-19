import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { desc, eq, inArray, sql } from "drizzle-orm";

import { policyVersions } from "@/db";
import { db } from "@/lib/db";

export type PolicyVersion = InferSelectModel<typeof policyVersions>;

export type NewPolicyVersion = InferInsertModel<
  typeof policyVersions
>;

type VersionDbClient = Pick<typeof db, "select" | "insert">;

export const policyVersionRepository = {
  async create(
    input: NewPolicyVersion,
    dbClient: VersionDbClient = db
  ): Promise<PolicyVersion> {
    const rows = await dbClient
      .insert(policyVersions)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async findLatestByPolicyId(
    policyId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<PolicyVersion | null> {
    const rows = await dbClient
      .select()
      .from(policyVersions)
      .where(eq(policyVersions.policyId, policyId))
      .orderBy(desc(policyVersions.version))
      .limit(1);

    return rows[0] ?? null;
  },

  /** One latest version per policy, keyed by policy id. */
  async findManyLatestByPolicyIds(
    policyIds: string[],
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Map<string, PolicyVersion>> {
    const result = new Map<string, PolicyVersion>();
    if (policyIds.length === 0) {
      return result;
    }

    const rows = await dbClient
      .select()
      .from(policyVersions)
      .where(inArray(policyVersions.policyId, policyIds))
      .orderBy(desc(policyVersions.version));

    for (const row of rows) {
      if (!result.has(row.policyId)) {
        result.set(row.policyId, row);
      }
    }

    return result;
  },

  async nextVersion(
    policyId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<number> {
    const rows = await dbClient
      .select({
        maxVersion: sql<number>`
          COALESCE(MAX(${policyVersions.version}), 0) + 1
        `,
      })
      .from(policyVersions)
      .where(eq(policyVersions.policyId, policyId));

    return Number(rows[0]?.maxVersion ?? 1);
  },
};

export default policyVersionRepository;