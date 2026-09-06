import {
  type OutboxQueueMessage,
  sendQueueMessage,
} from "@/lib/sqs";

export type PublishOutboxEventInput = {
  id: string;
  eventType: string;
};

export type PublishOutboxEventResult = {
  eventId: string;
  messageId: string;
};

/**
 * Publishes an outbox event reference to SQS.
 *
 * Stage 1 of the cron→SQS migration: this abstraction exists and is tested,
 * but nothing calls it yet. The Postgres outbox row remains the durable
 * source of truth — only `{eventId, eventType}` travels over SQS; the
 * worker re-loads the canonical payload (bearer links, tokens, PII stay in
 * the database and are covered by outbox retention purge).
 *
 * Delivery-state marking (e.g. `published_at`) and immediate post-commit
 * publish wiring land in a later stage. On failure this throws: the caller
 * owns retry/state decisions, and the DB row is always left intact so the
 * recovery publisher can deliver it later.
 */
export async function publishOutboxEvent(
  event: PublishOutboxEventInput,
): Promise<PublishOutboxEventResult> {
  const message: OutboxQueueMessage = {
    eventId: event.id,
    eventType: event.eventType,
  };

  const messageId = await sendQueueMessage(message);

  return { eventId: event.id, messageId };
}
