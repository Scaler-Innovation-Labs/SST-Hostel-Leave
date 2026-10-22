import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { outboxEvents } from "@/db";
import { db } from "@/lib/db";
import type { OutboxClaim } from "@/types/outbox/outbox-event";

export type OutboxEvent = InferSelectModel<
  typeof outboxEvents
>;

export type NewOutboxEvent = InferInsertModel<
  typeof outboxEvents
>;

type OutboxDbClient = Pick<
  typeof db,
  "insert" | "select" | "update"
> & {
  execute?: typeof db.execute;
};

// claimNext uses a raw UPDATE ... RETURNING * so it can claim rows
// atomically. Raw SQL results keep the database column names, so map them
// back to the camelCase shape the rest of the app (and the worker) expects.
// The node-postgres driver also returns raw timestamps as strings, and the
// claim guard needs real Dates to compare against timestamp columns.
function toDate(value: unknown): Date | null {
  return value == null ? null : new Date(value as string | Date);
}

function mapRawOutboxRow(row: Record<string, unknown>): OutboxEvent {
  return {
    id: row.id as string,
    eventType: row.event_type as OutboxEvent["eventType"],
    aggregateType: row.aggregate_type as OutboxEvent["aggregateType"],
    aggregateId: row.aggregate_id as string,
    payload: row.payload as OutboxEvent["payload"],
    idempotencyKey: (row.idempotency_key ?? null) as string | null,
    status: row.status as OutboxEvent["status"],
    attemptCount: row.attempt_count as number,
    lastError: (row.last_error ?? null) as string | null,
    nextAttemptAt: toDate(row.next_attempt_at),
    leaseExpiresAt: toDate(row.lease_expires_at),
    createdAt: toDate(row.created_at) as Date,
    processedAt: toDate(row.processed_at),
    claimedAt: toDate(row.claimed_at),
    publishedAt: toDate(row.published_at),
  };
}

/**
 * Only a worker that still owns the row may finalize it. The status guard
 * alone is not enough: after a lease expires the row can be requeued and
 * claimed again, returning to PROCESSING while the original worker is still
 * running. Matching the claim timestamps is a compare-and-set against that
 * specific claim.
 */
function processingClaimGuard(claim?: OutboxClaim) {
  return and(
    eq(outboxEvents.status, OUTBOX_STATUS.PROCESSING),
    claim
      ? and(
          claim.claimedAt
            ? eq(outboxEvents.claimedAt, claim.claimedAt)
            : isNull(outboxEvents.claimedAt),
          claim.leaseExpiresAt
            ? eq(outboxEvents.leaseExpiresAt, claim.leaseExpiresAt)
            : isNull(outboxEvents.leaseExpiresAt)
        )
      : undefined
  );
}

function staleProcessingGuard(graceMinutes: number) {
  const cutoff = new Date(Date.now() - graceMinutes * 60_000);

  return and(
    eq(outboxEvents.status, OUTBOX_STATUS.PROCESSING),
    // Use leaseExpiresAt if set; fall back to claimedAt grace for legacy rows.
    or(
      and(
        isNotNull(outboxEvents.leaseExpiresAt),
        lt(outboxEvents.leaseExpiresAt, new Date())
      ),
      and(
        isNull(outboxEvents.leaseExpiresAt),
        or(
          isNull(outboxEvents.claimedAt),
          lt(outboxEvents.claimedAt, cutoff)
        )
      )
    )
  );
}

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

  async findById(
    id: string,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);

    return rows[0] ?? null;
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

  /**
   * Atomically claim up to `limit` pending events using a single
   * UPDATE with FOR UPDATE SKIP LOCKED — the standard pattern for
   * reliable queue consumers in Postgres.
   *
   * This prevents two Vercel instances from claiming the same event
   * by locking candidate rows and skipping any already locked by
   * another transaction.
   */
  async claimNext(
    limit: number = 50,
    leaseMs: number = 5 * 60_000, // 5 minutes
    dbClient: OutboxDbClient = db
  ): Promise<OutboxEvent[]> {
    const now = new Date();
    const leaseExpires = new Date(now.getTime() + leaseMs);

    // Single atomic UPDATE with FOR UPDATE SKIP LOCKED — finds and
    // claims rows in one statement. Rows already locked by another
    // transaction are skipped, not waited on.
    const executor = dbClient.execute ?? db.execute;
    const rows = await executor(sql`
      UPDATE ${outboxEvents}
      SET
        status = ${OUTBOX_STATUS.PROCESSING},
        claimed_at = ${now},
        lease_expires_at = ${leaseExpires}
      WHERE id IN (
        SELECT id
        FROM ${outboxEvents}
        WHERE status = ${OUTBOX_STATUS.PENDING}
          AND (next_attempt_at IS NULL OR next_attempt_at < ${now})
        ORDER BY created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *
    `);

    return (rows.rows as Record<string, unknown>[]).map(mapRawOutboxRow);
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
        leaseExpiresAt: new Date(Date.now() + 5 * 60_000),
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
    claim?: OutboxClaim,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PROCESSED,
        processedAt: new Date(),
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        lastError: null,
      })
      .where(
        and(
          eq(outboxEvents.id, id),
          processingClaimGuard(claim)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  async markFailed(
    id: string,
    error: string,
    attemptCount?: number,
    claim?: OutboxClaim,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.FAILED,
        lastError: error,
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
        ...(attemptCount !== undefined ? { attemptCount } : {}),
      })
      .where(
        and(
          eq(outboxEvents.id, id),
          processingClaimGuard(claim)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  async markForRetry(
    id: string,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<OutboxEvent | null> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PENDING,
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      })
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
   *
   * Backoff: nextAttemptAt pushes the retry 15min × 2^attempts out (capped
   * at 4h). claimNext already filters on nextAttemptAt — previously nothing
   * ever wrote it, so every retry was immediately eligible.
   */
  async releaseForRetry(
    id: string,
    claim?: OutboxClaim,
    dbClient: Pick<typeof db, "update" | "select"> = db
  ): Promise<OutboxEvent | null> {
    const current = await dbClient
      .select({ attemptCount: outboxEvents.attemptCount })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id))
      .limit(1);

    const attempts = (current[0]?.attemptCount ?? 0) + 1;
    const backoffMinutes = Math.min(15 * 2 ** Math.min(attempts, 4), 240);

    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PENDING,
        attemptCount: sql`COALESCE(${outboxEvents.attemptCount}, 0) + 1`,
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: new Date(Date.now() + backoffMinutes * 60_000),
      })
      .where(
        and(
          eq(outboxEvents.id, id),
          processingClaimGuard(claim)
        )
      )
      .returning();

    return rows[0] ?? null;
  },

  /**
   * Retention purge candidates: PROCESSED rows whose delivery completed
   * before `cutoff`. PENDING / PROCESSING / FAILED rows are never
   * candidates — they may still be needed for delivery or retry.
   *
   * `processedAt` is the primary clock (set by markProcessed). Legacy rows
   * with NULL processedAt fall back to createdAt so they cannot accumulate
   * forever. Only ids are selected — payloads (which may carry bearer
   * approval links) are never loaded into memory by the purge path.
   */
  async findProcessedBefore(
    cutoff: Date,
    limit: number = 500,
    dbClient: Pick<typeof db, "select"> = db
  ): Promise<Array<Pick<OutboxEvent, "id">>> {
    const rows = await dbClient
      .select({ id: outboxEvents.id })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.status, OUTBOX_STATUS.PROCESSED),
          or(
            and(
              isNotNull(outboxEvents.processedAt),
              lt(outboxEvents.processedAt, cutoff)
            ),
            and(
              isNull(outboxEvents.processedAt),
              lt(outboxEvents.createdAt, cutoff)
            )
          )
        )
      )
      .orderBy(asc(outboxEvents.processedAt))
      .limit(limit);

    return rows;
  },

  /**
   * Deletes the given rows only if they are still PROCESSED. The status is
   * re-checked here (not just in the finder) so a concurrent state change
   * can never cause deletion of a row that left PROCESSED. PROCESSED is
   * terminal in every other transition (markForRetry/releaseForRetry only
   * accept FAILED/PROCESSING), so this guard is strictly defense-in-depth.
   */
  async deleteByIdsIfProcessed(
    ids: string[],
    dbClient: Pick<typeof db, "delete"> = db
  ): Promise<number> {
    if (ids.length === 0) return 0;

    const rows = await dbClient
      .delete(outboxEvents)
      .where(
        and(
          inArray(outboxEvents.id, ids),
          eq(outboxEvents.status, OUTBOX_STATUS.PROCESSED)
        )
      )
      .returning({ id: outboxEvents.id });

    return rows.length;
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
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.PENDING,
        // A crashed attempt still consumed one of the retry budget. Without
        // this, a handler that repeatedly kills the worker would be requeued
        // forever and never reach FAILED.
        attemptCount: sql`COALESCE(${outboxEvents.attemptCount}, 0) + 1`,
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      })
      .where(staleProcessingGuard(graceMinutes))
      .returning();

    return rows.length;
  },

  /**
   * Terminal-fail stale PROCESSING rows that have no retry budget left. This
   * runs before requeueStuckProcessing so a poison event that keeps crashing
   * the worker cannot loop forever.
   */
  async failStuckProcessing(
    graceMinutes: number,
    maxAttempts: number,
    dbClient: Pick<typeof db, "update"> = db
  ): Promise<number> {
    const rows = await dbClient
      .update(outboxEvents)
      .set({
        status: OUTBOX_STATUS.FAILED,
        attemptCount: maxAttempts,
        lastError: "Processing lease expired before completion",
        claimedAt: null,
        leaseExpiresAt: null,
        nextAttemptAt: null,
      })
      .where(
        and(
          staleProcessingGuard(graceMinutes),
          gte(outboxEvents.attemptCount, maxAttempts - 1)
        )
      )
      .returning();

    return rows.length;
  },
};

export default outboxRepository;
