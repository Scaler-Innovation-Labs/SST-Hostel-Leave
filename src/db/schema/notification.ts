// =====================================================
// NOTIFICATION DOMAIN SCHEMA
// src/db/schema/notification.ts
// =====================================================

import {
  boolean,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql/sql";

import { users } from "./auth";
import {
  notificationChannelEnum,
  notificationDeliveryStatusEnum,
  notificationEventEnum,
} from "./enums";
import { parents } from "./hostel";
import {
  leaveExtensions,
  leaveRequests,
  leaveTypes,
} from "./leave";

// =====================================================
// NOTIFICATION TEMPLATES
// =====================================================

export const notificationTemplates = pgTable(
  "notification_templates",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    code: text("code").notNull().unique(),

    eventKey: text("event_key").notNull(),

    channel: notificationChannelEnum("channel").notNull(),

    /** Leave type this template belongs to (null = global template for the event). */
    leaveTypeId: uuid("leave_type_id").references(
      () => leaveTypes.id,
      {
        onDelete: "set null",
      }
    ),

    subject: text("subject"),

    templateBody: text("template_body")
      .notNull(),

    isActive: boolean("is_active")
      .default(true)
      .notNull(),

    metadata: jsonb("metadata"),

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
  eventKeyIndex: index(
  "notification_template_event_key_idx"
).on(table.eventKey),

})
);

// =====================================================
// NOTIFICATION LOGS
// =====================================================

export const notificationLogs = pgTable(
  "notification_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    leaveRequestId: uuid("leave_request_id").references(
      () => leaveRequests.id,
      {
        onDelete: "cascade",
      }
    ),

    leaveExtensionId: uuid("leave_extension_id").references(
      () => leaveExtensions.id,
      {
        onDelete: "cascade",
      }
    ),

    userId: uuid("user_id").references(
      () => users.id,
      {
        onDelete: "set null",
      }
    ),

    parentId: uuid("parent_id").references(
      () => parents.id,
      {
        onDelete: "set null",
      }
    ),

    channel: notificationChannelEnum("channel").notNull(),

    eventType: notificationEventEnum("event_type").notNull(),

    recipient: text("recipient")
      .notNull(),

    ccRecipients: jsonb("cc_recipients"),

    deliveryStatus: notificationDeliveryStatusEnum("delivery_status")
      .notNull(),

    providerResponse: text("provider_response"),

    providerMessageId: text("provider_message_id"),

    sentAt: timestamp("sent_at", {
      withTimezone: true,
    }),

    readAt: timestamp("read_at", {
      withTimezone: true,
    }),

    metadata: jsonb("metadata"),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    parentConstraint: check(
      "notification_log_target_chk",
      sql`
        num_nonnulls(
          ${table.leaveRequestId},
          ${table.leaveExtensionId}
        ) = 1
      `
    ),

  userIdIndex: index(
    "notification_logs_user_id_idx"
  ).on(table.userId),

  parentIdIndex: index(
    "notification_logs_parent_id_idx"
  ).on(table.parentId),

  eventTypeIndex: index(
    "notification_logs_event_type_idx"
  ).on(table.eventType),

  deliveryStatusIndex: index(
    "notification_logs_delivery_status_idx"
  ).on(table.deliveryStatus),

  leaveRequestIdIndex: index(
    "notification_logs_leave_request_id_idx"
  ).on(table.leaveRequestId),

  createdAtIndex: index(
    "notification_logs_created_at_idx"
  ).on(table.createdAt),
})

);

// =====================================================
// CHANNEL TYPES (REFERENCE)
// =====================================================

// EMAIL
// SMS
// PUSH
// WEBHOOK

// =====================================================
// DELIVERY STATUS (REFERENCE)
// =====================================================

// PENDING
// SENT
// FAILED
// DELIVERED
// READ

// =====================================================
// EVENT TYPES (REFERENCE)
// =====================================================

// LEAVE_SUBMITTED
// LEAVE_APPROVED
// LEAVE_REJECTED
// LEAVE_EXTENSION_REQUESTED
// LEAVE_EXTENSION_APPROVED
// LEAVE_EXTENSION_REJECTED
// LEAVE_OVERDUE
// QR_GENERATED
// QR_INVALIDATED

// =====================================================
// SMS PARSED ACTIONS (REFERENCE)
// =====================================================

// APPROVE
// REJECT
// UNKNOWN

// =====================================================
// SMS PROCESSING STATUS (REFERENCE)
// =====================================================

// RECEIVED
// PARSED
// PROCESSED
// FAILED
