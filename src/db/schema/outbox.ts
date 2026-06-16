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

    status: outboxStatusEnum("status")
      .default("PENDING")
      .notNull(),

    attemptCount: integer("attempt_count")
      .default(0)
      .notNull(),

    lastError: text("last_error"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    processedAt: timestamp("processed_at", {
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
  })
);
