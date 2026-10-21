import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";
import {
  MAX_RETRIES,
  processPendingEvents,
} from "@/services/outbox/outbox-worker.service";

export async function runRetryOutboxJob(): Promise<{ job: string; failedStuck: number; recoveredStuck: number; resetCount: number; processed: number; failed: number; skipped: number }> {
  // Crash recovery: terminal-fail PROCESSING events that have already used
  // their retry budget, then requeue the rest. A handler that keeps crashing
  // the worker must not loop forever with an untouched attempt count.
  const failedStuck = await outboxRepository.failStuckProcessing(
    15,
    MAX_RETRIES
  );
  const recoveredStuck = await outboxRepository.requeueStuckProcessing(15);

  if (failedStuck > 0) {
    logger.error("Outbox events exhausted retries after stale leases", {
      failedStuck,
    });
  }

  // Only reset events that still have attempts left — exhausted events stay
  // FAILED instead of looping forever.
  const failedEvents = await outboxRepository.findFailed(100, MAX_RETRIES);

  let resetCount = 0;
  for (const event of failedEvents) {
    try {
      const reset = await outboxRepository.markForRetry(event.id);
      if (reset) resetCount++;
    } catch (error) {
      logger.error("Failed to reset outbox event for retry", {
        eventId: event.id,
        error,
      });
    }
  }

  const result = await processPendingEvents();

  return {
    job: "retry-outbox",
    failedStuck,
    recoveredStuck,
    resetCount,
    ...result,
  };
}
