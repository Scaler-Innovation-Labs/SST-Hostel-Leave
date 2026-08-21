import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import type { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

export type PublishEventInput = {
  eventType: OutboxEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
  /**
   * Optional idempotency key. If provided, the event will be inserted with
   * ON CONFLICT DO NOTHING on the unique idempotencyKey index — this prevents
   * duplicate outbox rows when a DB transaction commits but the external
   * provider call (SMS, email, Slack) times out and the caller retries.
   *
   * Recommended format: `${eventType}:${aggregateType}:${aggregateId}:${suffix}`
   * where suffix distinguishes logically distinct events with same identifiers
   * (e.g., different notification channels for the same leave approval).
   */
  idempotencyKey?: string;
};

function validateEvent(
  input: PublishEventInput
): void {
  if (!input.eventType) {
    throw new ValidationError("eventType is required");
  }
  if (!input.aggregateType) {
    throw new ValidationError("aggregateType is required");
  }
  if (!input.aggregateId) {
    throw new ValidationError("aggregateId is required");
  }
  if (!input.payload) {
    throw new ValidationError("payload is required");
  }
}

export const outboxService = {
  async publish(
    input: PublishEventInput,
    dbClient?: Pick<typeof db, "insert" | "select" | "update">
  ): Promise<void> {
    validateEvent(input);

    await outboxRepository.create(
      {
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        status: OUTBOX_STATUS.PENDING,
        attemptCount: 0,
        idempotencyKey: input.idempotencyKey,
      },
      dbClient
    );
  },

  async publishMany(
    inputs: PublishEventInput[],
    dbClient?: Pick<typeof db, "insert" | "select" | "update">
  ): Promise<void> {
    for (const input of inputs) {
      validateEvent(input);
    }

    await outboxRepository.createMany(
      inputs.map((input) => ({
        eventType: input.eventType,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        payload: input.payload,
        status: OUTBOX_STATUS.PENDING,
        attemptCount: 0,
        idempotencyKey: input.idempotencyKey,
      })),
      dbClient
    );
  },
};

