import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";

export type DomainEvent<
  T extends Record<string, unknown> = Record<
    string,
    unknown
  >
> = {
  eventType: OutboxEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: T;
};
