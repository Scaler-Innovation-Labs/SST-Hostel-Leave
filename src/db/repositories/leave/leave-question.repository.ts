import { desc, eq, sql } from "drizzle-orm";

import { type LeaveQuestion, leaveQuestions, type NewLeaveQuestion } from "@/db/schema/leave-question";
import { db } from "@/lib/db";
import type { DbClient } from "@/lib/db/transaction";

export const leaveQuestionRepository = {
  async create(
    input: NewLeaveQuestion,
    dbClient?: DbClient,
  ): Promise<LeaveQuestion> {
    const client = dbClient ?? db;
    const [row] = await client
      .insert(leaveQuestions)
      .values(input)
      .returning();
    return row!;
  },

  async findByLeaveRequestId(
    leaveRequestId: string,
    pagination: { page: number; limit: number },
    dbClient?: DbClient,
  ): Promise<{ items: LeaveQuestion[]; total: number }> {
    const client = dbClient ?? db;
    const offset = (pagination.page - 1) * pagination.limit;

    const where = eq(leaveQuestions.leaveRequestId, leaveRequestId);

    const [items, totalResult] = await Promise.all([
      client
        .select()
        .from(leaveQuestions)
        .where(where)
        .orderBy(desc(leaveQuestions.createdAt))
        .limit(pagination.limit)
        .offset(offset),
      client
        .select({ count: sql`count(*)` })
        .from(leaveQuestions)
        .where(where)
        .then((r) => Number(r[0]?.count ?? 0)),
    ]);

    return { items, total: totalResult };
  },

  async findById(id: string, dbClient?: DbClient): Promise<LeaveQuestion | undefined> {
    const client = dbClient ?? db;
    const [row] = await client
      .select()
      .from(leaveQuestions)
      .where(eq(leaveQuestions.id, id))
      .limit(1);
    return row;
  },

  async updateAnswer(
    id: string,
    answer: string,
    dbClient?: DbClient,
  ): Promise<LeaveQuestion | undefined> {
    const client = dbClient ?? db;
    const [row] = await client
      .update(leaveQuestions)
      .set({
        answer,
        status: "answered",
        answeredAt: new Date(),
      })
      .where(eq(leaveQuestions.id, id))
      .returning();
    return row;
  },
};
