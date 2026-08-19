import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { eq } from "drizzle-orm";

import { policyEvaluations } from "@/db";
import { db } from "@/lib/db";

export type PolicyEvaluation = InferSelectModel<
  typeof policyEvaluations
>;

export type NewPolicyEvaluation = InferInsertModel<
  typeof policyEvaluations
>;

type EvaluationDbClient = Pick<typeof db, "select" | "insert">;

export const policyEvaluationRepository = {
  async createMany(
    inputs: NewPolicyEvaluation[],
    dbClient: EvaluationDbClient = db
  ): Promise<PolicyEvaluation[]> {
    if (inputs.length === 0) {
      return [];
    }

    const rows = await dbClient
      .insert(policyEvaluations)
      .values(inputs)
      .returning();

    return rows;
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<PolicyEvaluation[]> {
    return dbClient
      .select()
      .from(policyEvaluations)
      .where(eq(policyEvaluations.leaveRequestId, leaveRequestId));
  },
};

export default policyEvaluationRepository;