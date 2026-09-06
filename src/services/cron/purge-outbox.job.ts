import {
  OUTBOX_PROCESSED_RETENTION_HOURS,
  OUTBOX_PURGE_BATCH_SIZE,
} from "@/constants/outbox/outbox-retention";
import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";

/**
 * Outbox retention purge: deletes PROCESSED events whose delivery completed
 * before the retention cutoff.
 *
 * Credential-lifetime bound: parent approval links are bearer credentials
 * that must exist in the outbox payload for delivery. Once PROCESSED, the
 * payload has no delivery purpose — but it would otherwise keep the raw
 * link in the database indefinitely. PENDING / PROCESSING / FAILED rows
 * are never touched: they may still be needed for delivery or retry.
 *
 * Properties:
 * - Bounded batches (a large first-run backlog cannot starve the worker).
 * - Idempotent: re-running purges only rows that newly aged past the
 *   cutoff; deleting an already-deleted id is a no-op via the finder.
 * - Count-only logging: ids, payloads, links, and tokens never enter logs.
 *   Audit history stays in the audit system, independent of this purge.
 */
export async function runPurgeOutboxJob(
  now: Date = new Date()
): Promise<{ job: string; purged: number; cutoff: string }> {
  const cutoff = new Date(
    now.getTime() - OUTBOX_PROCESSED_RETENTION_HOURS * 60 * 60 * 1000
  );

  let purgedCount = 0;

  while (true) {
    const candidates = await outboxRepository.findProcessedBefore(
      cutoff,
      OUTBOX_PURGE_BATCH_SIZE
    );

    if (candidates.length === 0) break;

    purgedCount += await outboxRepository.deleteByIdsIfProcessed(
      candidates.map((c) => c.id)
    );

    if (candidates.length < OUTBOX_PURGE_BATCH_SIZE) break;
  }

  logger.info("Outbox retention purge completed", {
    job: "purge-outbox",
    purged: purgedCount,
    cutoff: cutoff.toISOString(),
  });

  return {
    job: "purge-outbox",
    purged: purgedCount,
    cutoff: cutoff.toISOString(),
  };
}
