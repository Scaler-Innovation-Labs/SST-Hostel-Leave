// =====================================================
// OUTBOX DOMAIN SCHEMA
// src/db/schema/outbox.ts
// =====================================================

import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { outboxStatusEnum } from "./enums";

// =====================================================
// OUTBOX EVENTS
// =====================================================

export const outboxEvents = pgTable(
  "outbox_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    eventType: text("event_type").notNull(),

    aggregateType: text("aggregate_type").notNull(),

    aggregateId: uuid("aggregate_id").notNull(),

    payload: jsonb("payload").notNull(),

    // Idempotency key: prevents duplicate notifications when a DB transaction
    // commits but the external provider call is uncertain (timeout, retry).
    // Format: ${eventType}:${aggregateType}:${aggregateId}:${optionalSuffix}
    idempotencyKey: text("idempotency_key"),

    status: outboxStatusEnum("status")
      .default("PENDING")
      .notNull(),

    attemptCount: integer("attempt_count")
      .default(0)
      .notNull(),

    lastError: text("last_error"),

    // Next scheduled attempt time — enables exponential backoff without
    // polling all PENDING rows. NULL means ready now.
    nextAttemptAt: timestamp("next_attempt_at", {
      withTimezone: true,
    }),

    // Lease expiry for worker claiming — prevents a crashed worker from
    // holding an event indefinitely. Set when claimed; cleared on release.
    leaseExpiresAt: timestamp("lease_expires_at", {
      withTimezone: true,
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    processedAt: timestamp("processed_at", {
      withTimezone: true,
    }),

    claimedAt: timestamp("claimed_at", {
      withTimezone: true,
    }),

    // Legacy delivery marker from the old SQS transport (kept nullable for
    // historic rows). The worker now drains PENDING rows straight from the
    // DB, so nothing sets or reads this on the write path anymore.
    publishedAt: timestamp("published_at", {
      withTimezone: true,
    }),
  },
  (table) => ({
    statusIndex: index("outbox_events_status_idx").on(
      table.status
    ),
    createdAtIndex: index("outbox_events_created_at_idx").on(
      table.createdAt
    ),
    aggregateIndex: index("outbox_events_aggregate_idx").on(
      table.aggregateType,
      table.aggregateId
    ),
    eventTypeIndex: index("outbox_events_event_type_idx").on(
      table.eventType
    ),
    statusCreatedIdx: index("oe_status_created_idx").on(
      table.status,
      table.createdAt
    ),
    // For efficient claim loop: find PENDING events ready for retry
    statusNextAttemptIdx: index("oe_status_next_attempt_idx").on(
      table.status,
      table.nextAttemptAt
    ),
    // Legacy index from the SQS transport; retained to avoid a prod index
    // drop. Not used by the DB-poll claim loop.
    statusPublishedIdx: index("oe_status_published_idx").on(
      table.status,
      table.publishedAt
    ),
    // Unique constraint on idempotency key — ensures at-least-once DB insert
    // never creates duplicate outbox rows for the same logical event.
    idempotencyKeyUniqueIdx: uniqueIndex("outbox_events_idempotency_key_unique_idx").on(
      table.idempotencyKey
    ),
  })
);
