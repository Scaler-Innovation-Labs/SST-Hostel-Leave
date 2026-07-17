import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";
import { processPendingEvents } from "@/services/outbox/outbox-worker.service";

export async function runRetryOutboxJob() {
  const failedEvents = await outboxRepository.findFailed(100);

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
    resetCount,
    ...result,
  };
}
