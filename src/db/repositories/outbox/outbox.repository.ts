import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, eq, isNull, lt, or, sql } from "drizzle-orm";

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
  ): Promise<OutboxEvent | null> {
    // If idempotencyKey is provided, use ON CONFLICT DO NOTHING to prevent
    // duplicate rows when the same logical event is retried.
    if (input.idempotencyKey) {
      const rows = await dbClient
        .insert(outboxEvents)
        .values(input)
        .onConflictDoNothing({
          target: outboxEvents.idempotencyKey,
        })
        .returning();

      return rows[0] ?? null;
    }

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

    // Separate inputs with and without idempotencyKey
    const withKey = inputs.filter((i) => i.idempotencyKey);
    const withoutKey = inputs.filter((i) => !i.idempotencyKey);

    const results: OutboxEvent[] = [];

    if (withKey.length > 0) {
      const rows = await dbClient
        .insert(outboxEvents)
        .values(withKey)
        .onConflictDoNothing({
          target: outboxEvents.idempotencyKey,
        })
        .returning();
      results.push(...rows);
    }

    if (withoutKey.length > 0) {
      const rows = await dbClient
        .insert(outboxEvents)
        .values(withoutKey)
        .returning();
      results.push(...rows);
    }

    return results;
  },

  async findFailed(
    limit: number = 50,
    maxAttempts?: number,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<OutboxEvent[]> {
    const rows = await dbClient
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.status, OUTBOX_STATUS.FAILED),
          maxAttempts !== undefined
            ? or(
                isNull(outboxEvents.attemptCount),
                lt(outboxEvents.attemptCount, maxAttempts)
              )
            : undefined
        )
      )
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
      .set({
        status: OUTBOX_STATUS.PROCESSING,
        claimedAt: new Date(),
      })
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
    attemptCount?: number,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.FAILED,
        lastError: error,
        ...(attemptCount !== undefined ? { attemptCount } : {}),
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

  /**
   * Requeue a PROCESSING event after a transient handler failure. The event
   * goes back to PENDING (with one more attempt counted) so the next worker
   * run picks it up again — previously the event stayed PROCESSING forever
   * and was invisible to both findPending and findFailed.
   */
  async releaseForRetry(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PENDING,
        attemptCount: sql`COALESCE(${outboxEvents.attemptCount}, 0) + 1`,
        claimedAt: null,
      })
      .where(
        and(
          eq(outboxEvents.id, id),
          eq(outboxEvents.status, OUTBOX_STATUS.PROCESSING)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  /**
   * Crash recovery: requeue PROCESSING events whose claim is stale. A claim
   * is stale when the worker that took it died mid-processing (no
   * markProcessed/markFailed/releaseForRetry ever arrived) — either the
   * claim timestamp is missing (legacy rows) or older than the grace period.
   */
  async requeueStuckProcessing(
    graceMinutes: number,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<number> {
    const cutoff = new Date(
      Date.now() - graceMinutes * 60_000
    );

    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PENDING,
        claimedAt: null,
      })
      .where(
        and(
          eq(outboxEvents.status, OUTBOX_STATUS.PROCESSING),
          or(
            isNull(outboxEvents.claimedAt),
            lt(outboxEvents.claimedAt, cutoff)
          )
        )
      )
      .returning();

    return rows.length;
  },
};

export default outboxRepository;
