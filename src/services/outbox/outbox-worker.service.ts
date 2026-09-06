import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { type OutboxEvent,outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import type {
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
  const skipped = 0;

  for (const event of claimedEvents) {
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
        // Exhausted: mark FAILED with the attempt budget consumed so the
        // cron never requeues a permanently failing event.
        await outboxRepository.markFailed(
          eventRow.id,
          errorMessage,
          MAX_RETRIES
        );
      } else {
        // Transient failure: requeue as PENDING with one more attempt
        // counted. The status must be reset — an event left in PROCESSING
        // is invisible to both findPending and findFailed.
        await outboxRepository.releaseForRetry(eventRow.id);
      }
      failed++;
    }
  }

  return { processed, failed, skipped };
}

/**
 * Outcome of processing one outbox event by id (SQS worker path).
 *
 * - `processed`: handler ran and the row is PROCESSED.
 * - `skipped-processed`: row already PROCESSED (duplicate SQS delivery).
 * - `skipped-claimed`: another worker holds the row; leave the message
 *   for redelivery after the visibility timeout.
 * - `failed-transient`: handler threw within budget; row released for
 *   retry. The SQS message must NOT be deleted (redrive retries it).
 * - `failed-terminal`: row marked FAILED (unknown type or budget
 *   exhausted). The DB row — never purged — is the failure record.
 * - `missing`: no row (purged after processing, or never existed).
 */
export type SingleEventOutcome =
  | "processed"
  | "skipped-processed"
  | "skipped-claimed"
  | "failed-transient"
  | "failed-terminal"
  | "missing";

/**
 * Terminal outcomes are safe for SQS deletion: reprocessing them can never
 * change the result. Non-terminal outcomes must keep the message visible
 * for redelivery (transient failure) or competing-worker progress
 * (claim race).
 */
export function isTerminalOutcome(outcome: SingleEventOutcome): boolean {
  return (
    outcome === "processed" ||
    outcome === "skipped-processed" ||
    outcome === "failed-terminal" ||
    outcome === "missing"
  );
}

/**
 * SQS worker entry point for a single event. Mirrors the finalize
 * semantics of `processPendingEvents` (same budget, backoff, and
 * permanent-failure rules) but claims one row via the guarded
 * PENDING→PROCESSING transition instead of the batch claim, so the cron
 * batch path and SQS workers can never handle the same row twice.
 *
 * Idempotency: a duplicate delivery finds the row PROCESSED and returns
 * `skipped-processed` without re-running the handler.
 */
export async function processSingleEvent(
  eventId: string,
): Promise<SingleEventOutcome> {
  const event = await outboxRepository.findById(eventId);

  if (!event) {
    return "missing";
  }

  if (event.status === OUTBOX_STATUS.PROCESSED) {
    return "skipped-processed";
  }

  if (event.status === OUTBOX_STATUS.FAILED) {
    return "failed-terminal";
  }

  if (event.status !== OUTBOX_STATUS.PENDING) {
    // PROCESSING (or any future in-flight state): another worker owns it.
    return "skipped-claimed";
  }

  const claimed = await outboxRepository.markProcessing(event.id);
  if (!claimed) {
    // Lost a claim race between the read above and the guarded update.
    return "skipped-claimed";
  }

  const eventRow = toEventRow(claimed);
  const handler = getHandler(eventRow.eventType);

  if (!handler) {
    await outboxRepository.markFailed(
      eventRow.id,
      `No handler for event type: ${eventRow.eventType}`
    );
    return "failed-terminal";
  }

  try {
    await handler(eventRow);
    await outboxRepository.markProcessed(eventRow.id);
    return "processed";
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);

    if ((eventRow.attemptCount ?? 0) + 1 >= MAX_RETRIES) {
      await outboxRepository.markFailed(
        eventRow.id,
        errorMessage,
        MAX_RETRIES
      );
      return "failed-terminal";
    }

    await outboxRepository.releaseForRetry(eventRow.id);
    return "failed-transient";
  }
}
