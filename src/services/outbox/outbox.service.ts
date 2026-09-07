import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import {
  type OutboxEvent,
  outboxRepository,
} from "@/db/repositories/outbox/outbox.repository";
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

// Writes the outbox event row inside the caller's transaction. The row IS the
// delivery mechanism: the outbox worker (see outbox-worker.service.ts) drains
// PENDING rows straight from the DB on a short interval, so recording the row
// is all a caller needs to do — there is no separate publish step.
export const outboxService = {
  async publish(
    input: PublishEventInput,
    dbClient?: Pick<typeof db, "insert" | "select" | "update">
  ): Promise<OutboxEvent | null> {
    validateEvent(input);

    const created = await outboxRepository.create(
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

    return created;
  },

  async publishMany(
    inputs: PublishEventInput[],
    dbClient?: Pick<typeof db, "insert" | "select" | "update">
  ): Promise<Array<OutboxEvent | null>> {
    for (const input of inputs) {
      validateEvent(input);
    }

    const created = await outboxRepository.createMany(
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

    return created;
  },
};
