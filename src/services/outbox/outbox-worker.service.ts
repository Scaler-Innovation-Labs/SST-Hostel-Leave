import { type OutboxEvent,outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { logger } from "@/lib/logger";
import type {
  OutboxClaim,
  OutboxEventRow,
} from "@/types/outbox/outbox-event";

import { handleLeaveEvent } from "./handlers/leave-event.handler";
import { handleMovementEvent } from "./handlers/movement-event.handler";
import { handleNotificationEvent } from "./handlers/notification-event.handler";

export const MAX_RETRIES = 5;

function getHandler(
  eventType: string
): ((event: OutboxEventRow) => Promise<void>) | null {
  if (
    eventType.startsWith("LEAVE_") ||
    eventType === "QR_GENERATED" ||
    eventType === "QR_SCANNED" ||
    eventType === "QR_INVALIDATED"
  ) {
    if (
      eventType === "QR_GENERATED" ||
      eventType === "QR_SCANNED" ||
      eventType === "QR_INVALIDATED"
    ) {
      return handleMovementEvent;
    }
    return handleLeaveEvent;
  }

  if (eventType.startsWith("MOVEMENT_")) {
    return handleMovementEvent;
  }

  if (eventType === "PARENT_APPROVAL_REQUIRED") {
    return handleLeaveEvent;
  }

  if (eventType === "NOTIFICATION_REQUESTED") {
    return handleNotificationEvent;
  }

  return null;
}

function toEventRow(event: OutboxEvent): OutboxEventRow {
  return {
    id: event.id,
    eventType: event.eventType as OutboxEventRow["eventType"],
    aggregateType: event.aggregateType as OutboxEventRow["aggregateType"],
    aggregateId: event.aggregateId,
    payload: event.payload as Record<string, unknown>,
    status: event.status as OutboxEventRow["status"],
    attemptCount: event.attemptCount,
    lastError: event.lastError,
    createdAt: event.createdAt,
    processedAt: event.processedAt,
    claimedAt: event.claimedAt,
    leaseExpiresAt: event.leaseExpiresAt,
  };
}

function claimOf(event: OutboxEventRow): OutboxClaim {
  return {
    claimedAt: event.claimedAt ?? null,
    leaseExpiresAt: event.leaseExpiresAt ?? null,
  };
}

export async function processPendingEvents(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  // Use atomic claim with lease to prevent double-processing
  // across concurrent Vercel serverless instances.
  const claimedEvents =
    await outboxRepository.claimNext(50, 5 * 60_000);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of claimedEvents) {
    const eventRow = toEventRow(event);
    const claim = claimOf(eventRow);

    const handler = getHandler(eventRow.eventType);

    if (!handler) {
      // Unknown event types are permanent configuration errors, not
      // transient delivery failures: consume the whole retry budget so the
      // row lands FAILED and stays there. Otherwise the retry job (which
      // resets FAILED rows with remaining budget) would loop it
      // FAILED → PENDING → FAILED on every drain run forever.
      const reason = `No handler for event type: ${eventRow.eventType}`;
      const marked = await outboxRepository.markFailed(
        eventRow.id,
        reason,
        MAX_RETRIES,
        claim
      );

      if (marked) {
        failed++;
        logger.error("Outbox event terminally failed", {
          eventId: eventRow.id,
          eventType: eventRow.eventType,
          reason,
        });
      } else {
        skipped++;
        logger.warn("Outbox claim lost before terminal failure", {
          eventId: eventRow.id,
          eventType: eventRow.eventType,
        });
      }
      continue;
    }

    try {
      await handler(eventRow);
      const marked = await outboxRepository.markProcessed(
        eventRow.id,
        claim
      );

      if (marked) {
        processed++;
      } else {
        // The handler ran, but this worker no longer owned the row (its
        // lease expired and another worker re-claimed it). Do not claim
        // success for a row someone else now owns.
        skipped++;
        logger.warn("Outbox claim lost before markProcessed", {
          eventId: eventRow.id,
          eventType: eventRow.eventType,
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        (eventRow.attemptCount ?? 0) + 1 >= MAX_RETRIES
      ) {
        // Exhausted: mark FAILED with the attempt budget consumed so the
        // cron never requeues a permanently failing event.
        const marked = await outboxRepository.markFailed(
          eventRow.id,
          errorMessage,
          MAX_RETRIES,
          claim
        );

        if (marked) {
          failed++;
          logger.error("Outbox event exhausted retries", {
            eventId: eventRow.id,
            eventType: eventRow.eventType,
            error: errorMessage,
          });
        } else {
          skipped++;
          logger.warn("Outbox claim lost before terminal failure", {
            eventId: eventRow.id,
            eventType: eventRow.eventType,
          });
        }
      } else {
        // Transient failure: requeue as PENDING with one more attempt
        // counted. The status must be reset — an event left in PROCESSING
        // is invisible to both findPending and findFailed.
        const released = await outboxRepository.releaseForRetry(
          eventRow.id,
          claim
        );

        if (released) {
          failed++;
        } else {
          skipped++;
          logger.warn("Outbox claim lost before releaseForRetry", {
            eventId: eventRow.id,
            eventType: eventRow.eventType,
          });
        }
      }
    }
  }

  return { processed, failed, skipped };
}
