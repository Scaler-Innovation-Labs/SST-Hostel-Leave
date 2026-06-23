// =====================================================
// NOTIFICATION RULES SCHEMA
// src/db/schema/notification-rules.ts
// =====================================================

import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import {
  notificationChannelEnum,
  notificationEventEnum,
  notificationRecipientTypeEnum,
} from "./enums";
import { leaveTypes } from "./leave";
import { notificationTemplates } from "./notification";

// =====================================================
// NOTIFICATION RULES
// =====================================================

export const notificationRules = pgTable(
  "notification_rules",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    leaveTypeId: uuid("leave_type_id").references(
      () => leaveTypes.id,
      { onDelete: "cascade" }
    ),

    eventType: notificationEventEnum("event_type").notNull(),

    templateId: uuid("template_id")
      .references(() => notificationTemplates.id, {
        onDelete: "restrict",
      })
      .notNull(),

    enabled: boolean("enabled").default(true).notNull(),

    customRecipients: jsonb("custom_recipients"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    updatedAt: timestamp("updated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    leaveTypeEventIndex: index(
      "notification_rules_leave_type_event_idx"
    ).on(table.leaveTypeId, table.eventType),
  })
);

// =====================================================
// NOTIFICATION RULE RECIPIENTS
// =====================================================

export const notificationRuleRecipients = pgTable(
  "notification_rule_recipients",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ruleId: uuid("rule_id")
      .references(() => notificationRules.id, {
        onDelete: "cascade",
      })
      .notNull(),

    recipientType: notificationRecipientTypeEnum(
      "recipient_type"
    ).notNull(),
  },
  (table) => ({
    ruleRecipientUnique: unique(
      "notification_rule_recipient_unq"
    ).on(table.ruleId, table.recipientType),
  })
);

// =====================================================
// NOTIFICATION RULE CHANNELS
// =====================================================

export const notificationRuleChannels = pgTable(
  "notification_rule_channels",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    ruleId: uuid("rule_id")
      .references(() => notificationRules.id, {
        onDelete: "cascade",
      })
      .notNull(),

    channel: notificationChannelEnum("channel").notNull(),
  },
  (table) => ({
    ruleChannelUnique: unique(
      "notification_rule_channel_unq"
    ).on(table.ruleId, table.channel),
  })
);
