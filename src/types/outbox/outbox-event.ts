import type {
  AggregateType,
} from "@/constants/outbox/aggregate-types";
import type {
  OutboxEventType,
} from "@/constants/outbox/event-types";
import type {
  OutboxStatus,
} from "@/constants/outbox/outbox-status";

/**
 * The claim metadata a worker must present to finalize an event. `claimNext`
 * writes these values atomically; comparing them on the terminal update
 * prevents a worker whose lease expired from overwriting the state of a row
 * another worker has since re-claimed.
 */
export type OutboxClaim = {
  claimedAt: Date | null;
  leaseExpiresAt: Date | null;
};

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
  claimedAt?: Date | null;
  leaseExpiresAt?: Date | null;
};
