import { outboxRepository, type OutboxEvent } from "@/db/repositories/outbox/outbox.repository";
import type {
  OutboxEventRow,
} from "@/types/outbox/outbox-event";

import { handleLeaveEvent } from "./handlers/leave-event.handler";
import { handleMovementEvent } from "./handlers/movement-event.handler";
import { handleNotificationEvent } from "./handlers/notification-event.handler";

const MAX_RETRIES = 5;

function getHandler(
  eventType: string
): ((event: OutboxEventRow) => Promise<void>) | null {
  if (
    eventType.startsWith("LEAVE_") ||
    eventType === "QR_GENERATED" ||
    eventType === "QR_SCANNED"
  ) {
    if (
      eventType === "QR_GENERATED" ||
      eventType === "QR_SCANNED"
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
  };
}

export async function processPendingEvents(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const pendingEvents =
    await outboxRepository.findPending(50);

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const event of pendingEvents) {
    const locked =
      await outboxRepository.markProcessing(event.id);

    if (!locked) {
      skipped++;
      continue;
    }

    const eventRow = toEventRow(event);

    const handler = getHandler(eventRow.eventType);

    if (!handler) {
      await outboxRepository.markFailed(
        eventRow.id,
        `No handler for event type: ${eventRow.eventType}`
      );
      failed++;
      continue;
    }

    try {
      await handler(eventRow);
      await outboxRepository.markProcessed(eventRow.id);
      processed++;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : String(error);

      if (
        (eventRow.attemptCount ?? 0) + 1 >= MAX_RETRIES
      ) {
        await outboxRepository.markFailed(
          eventRow.id,
          errorMessage
        );
      } else {
        await outboxRepository.incrementAttemptCount(
          eventRow.id
        );
      }
      failed++;
    }
  }

  return { processed, failed, skipped };
}
