import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import { OUTBOX_STATUS } from "@/constants/outbox/outbox-status";
import { outboxRepository } from "@/db/repositories/outbox/outbox.repository";
import { ValidationError } from "@/lib/errors";

export type PublishEventInput = {
  eventType: OutboxEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
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
    dbClient?: Pick<
      typeof import("@/lib/db").db,
      "insert" | "select" | "update"
    >
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
      },
      dbClient
    );
  },

  async publishMany(
    inputs: PublishEventInput[],
    dbClient?: Pick<
      typeof import("@/lib/db").db,
      "insert" | "select" | "update"
    >
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
      })),
      dbClient
    );
  },
};

