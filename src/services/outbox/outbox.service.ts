import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import { OUTBOX_IMMEDIATE_DELAY_MS } from "@/constants/outbox/outbox-publish";
import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import {
  type OutboxEvent,
  outboxRepository,
} from "@/db/repositories/outbox/outbox.repository";
import type { db } from "@/lib/db";
import { ValidationError } from "@/lib/errors";

import { publishOutboxEvent } from "./outbox-publisher.service";

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

    kickImmediatePublish(created ? [created] : []);

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

    kickImmediatePublish(created);

    return created;
  },
};

/**
 * Best-effort post-commit SQS attempt (near-instant path; the recovery
 * publisher remains the durability guarantee).
 *
 * Fire-and-forget by design: it never throws and never blocks the caller.
 * After a short delay (so the business transaction usually commits
 * first) each row is re-read — an invisible row means "uncommitted or
 * gone", and the attempt is skipped silently for the recovery publisher
 * to deliver later. `published_at` is stamped only after a successful
 * send, so a skipped/failed attempt is indistinguishable from "never
 * tried". No-op when no queue is configured (Stage 1 state).
 */
function kickImmediatePublish(events: Array<OutboxEvent | null>): void {
  if (!process.env.OUTBOX_QUEUE_URL) return;
  const ids = events
    .map((event) => event?.id)
    .filter((id): id is string => id !== undefined);
  if (ids.length === 0) return;
  void attemptImmediatePublish(ids).catch(() => {
    // Recovery publisher owns every failure mode here.
  });
}

async function attemptImmediatePublish(ids: string[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, OUTBOX_IMMEDIATE_DELAY_MS));

  for (const id of ids) {
    try {
      const current = await outboxRepository.findById(id);
      if (
        !current ||
        current.status !== OUTBOX_STATUS.PENDING ||
        current.publishedAt
      ) {
        continue;
      }
      await publishOutboxEvent({
        id: current.id,
        eventType: current.eventType,
      });
      await outboxRepository.markPublished(current.id);
    } catch {
      // Skipped silently — the recovery publisher delivers it later.
    }
  }
}

