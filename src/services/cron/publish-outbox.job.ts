import {
  OUTBOX_PUBLISH_BATCH_SIZE,
  OUTBOX_PUBLISH_HOLD_MINUTES,
  OUTBOX_PUBLISH_STALE_MINUTES,
} from "@/constants/outbox/outbox-publish";
import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";
import { publishOutboxEvent } from "@/services/outbox/outbox-publisher.service";

/**
 * SQS recovery publisher (safety net, not the primary path).
 *
 * Publishes PENDING outbox rows that never reached SQS:
 * 1. never-published rows (`published_at IS NULL`) — covers process
 *    crashes between DB commit and the immediate publish attempt, and
 *    immediate attempts skipped on send failure;
 * 2. stale-published rows (stamped long ago but still PENDING) — covers
 *    "SQS accepted but the response was lost" and "message deleted
 *    without processing".
 *
 * Claiming only pushes `next_attempt_at` out (no status/lease change), so
 * a failed send is retried by a later run and publish retries never
 * consume the handler retry budget. Per-item isolation: one SQS failure
 * never aborts the rest of the batch.
 *
 * Stage 2 wiring: invoked manually / by the EC2 publisher loop. The
 * Vercel cron route is NOT repurposed yet (Stage 3 cutover).
 */
export async function runPublishOutboxJob(): Promise<{
  job: string;
  published: number;
  republished: number;
  failed: number;
}> {
  let published = 0;
  let republished = 0;
  let failed = 0;

  const fresh = await outboxRepository.claimUnpublished(
    OUTBOX_PUBLISH_BATCH_SIZE,
    OUTBOX_PUBLISH_HOLD_MINUTES
  );

  for (const event of fresh) {
    try {
      await publishOutboxEvent({
        id: event.id,
        eventType: event.eventType,
      });
      await outboxRepository.markPublished(event.id);
      published++;
    } catch (error) {
      failed++;
      logger.error("Outbox publish failed", {
        eventId: event.id,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const stale = await outboxRepository.claimStalePublished(
    OUTBOX_PUBLISH_BATCH_SIZE,
    OUTBOX_PUBLISH_STALE_MINUTES,
    OUTBOX_PUBLISH_HOLD_MINUTES
  );

  for (const event of stale) {
    try {
      await publishOutboxEvent({
        id: event.id,
        eventType: event.eventType,
      });
      await outboxRepository.markPublished(event.id);
      republished++;
    } catch (error) {
      failed++;
      logger.error("Outbox republish failed", {
        eventId: event.id,
        eventType: event.eventType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { job: "publish-outbox", published, republished, failed };
}
