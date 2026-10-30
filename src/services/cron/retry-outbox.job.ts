import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";
import {
  MAX_RETRIES,
  processPendingEvents,
} from "@/services/outbox/outbox-worker.service";

export async function runRetryOutboxJob(): Promise<{
  job: string;
  failedStuck: number;
  recoveredStuck: number;
  resetCount: number;
  processed: number;
  failed: number;
  skipped: number;
}> {
  // Fast path: inspect active status counts before issuing blind recovery and retry updates.
  // If the outbox has no non-terminal rows (PENDING, PROCESSING, FAILED), short-circuit immediately.
  const activeCounts = outboxRepository.getActiveStatusCounts
    ? await outboxRepository.getActiveStatusCounts()
    : null;

  if (activeCounts && activeCounts.total === 0) {
    return {
      job: "retry-outbox",
      failedStuck: 0,
      recoveredStuck: 0,
      resetCount: 0,
      processed: 0,
      failed: 0,
      skipped: 0,
    };
  }

  // Crash recovery: terminal-fail PROCESSING events that have already used
  // their retry budget, then requeue the rest. Only executed if PROCESSING rows
  // actually exist (or in legacy/test contexts where active status check is bypassed).
  let failedStuck = 0;
  let recoveredStuck = 0;
  if (!activeCounts || activeCounts.processing > 0) {
    failedStuck = await outboxRepository.failStuckProcessing(
      15,
      MAX_RETRIES
    );
    recoveredStuck = await outboxRepository.requeueStuckProcessing(15);

    if (failedStuck > 0) {
      logger.error("Outbox events exhausted retries after stale leases", {
        failedStuck,
      });
    }
  }

  // Only reset events that still have attempts left — exhausted events stay
  // FAILED instead of looping forever. Only executed if FAILED rows exist.
  let resetCount = 0;
  if (!activeCounts || activeCounts.failed > 0) {
    const failedEvents = await outboxRepository.findFailed(100, MAX_RETRIES);

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
  }

  // Process pending events: run if PENDING events exist, if failed events were reset,
  // if processing events were requeued, or if active status check was bypassed.
  let result = { processed: 0, failed: 0, skipped: 0 };
  if (
    !activeCounts ||
    activeCounts.pending > 0 ||
    resetCount > 0 ||
    recoveredStuck > 0
  ) {
    result = await processPendingEvents();
  }

  return {
    job: "retry-outbox",
    failedStuck,
    recoveredStuck,
    resetCount,
    ...result,
  };
}
