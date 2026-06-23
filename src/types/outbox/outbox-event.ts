import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import type {
  OutboxStatus,
} from "@/constants/outbox/outbox-status";

export type OutboxEventRow = {
  id: string;
  eventType: OutboxEventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
  processedAt: Date | null;
};
