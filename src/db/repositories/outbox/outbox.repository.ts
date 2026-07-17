import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, eq, sql } from "drizzle-orm";

import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { outboxEvents } from "@/db";
import { db } from "@/lib/db";

export type OutboxEvent = InferSelectModel<
  typeof outboxEvents
>;

export type NewOutboxEvent = InferInsertModel<
  typeof outboxEvents
>;

type OutboxDbClient = Pick<
  typeof db,
  "insert" | "select" | "update"
>;

export const outboxRepository = {
  async create(
    input: NewOutboxEvent,
    dbClient: OutboxDbClient = db
  ): Promise<OutboxEvent> {
    const rows = await dbClient
      .insert(outboxEvents)
      .values(input)
      .returning();

    return rows[0]!;
  },

  async createMany(
    inputs: NewOutboxEvent[],
    dbClient: OutboxDbClient = db
  ): Promise<OutboxEvent[]> {
    if (inputs.length === 0) return [];

    const rows = await dbClient
      .insert(outboxEvents)
      .values(inputs)
      .returning();

    return rows;
  },

  async findFailed(
    limit: number = 50,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<OutboxEvent[]> {
    const rows = await dbClient
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.status, OUTBOX_STATUS.FAILED))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(limit);

    return rows;
  },

  async findPending(
    limit: number = 50,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<OutboxEvent[]> {
    const rows = await dbClient
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.status, OUTBOX_STATUS.PENDING))
      .orderBy(asc(outboxEvents.createdAt))
      .limit(limit);

    return rows;
  },

  async markProcessing(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({ status: OUTBOX_STATUS.PROCESSING })
      .where(
        and(
          eq(outboxEvents.id, id),
          eq(outboxEvents.status, OUTBOX_STATUS.PENDING)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  async markProcessed(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PROCESSED,
        processedAt: new Date(),
      })
      .where(eq(outboxEvents.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async markFailed(
    id: string,
    error: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.FAILED,
        lastError: error,
      })
      .where(eq(outboxEvents.id, id))
      .returning();

    return rows[0] ?? null;
  },

  async markForRetry(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({ status: OUTBOX_STATUS.PENDING })
      .where(
        and(
          eq(outboxEvents.id, id),
          eq(outboxEvents.status, OUTBOX_STATUS.FAILED)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  async incrementAttemptCount(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<void> {
    await dbClient
      .update(outboxEvents)
      .set({
        attemptCount: sql`COALESCE(${outboxEvents.attemptCount}, 0) + 1`,
      })
      .where(eq(outboxEvents.id, id));
  },
};

export default outboxRepository;
