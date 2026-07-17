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
  sheetSyncStatusEnum,
  smsParsedActionEnum,
  smsProcessingStatusEnum,
} from "./enums";
import { parents } from "./hostel";
import {
  leaveExtensions,
  leaveRequests,
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
})

);

// =====================================================
// INBOUND SMS LOGS
// =====================================================

export const inboundSmsLogs = pgTable(
  "inbound_sms_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    parentId: uuid("parent_id").references(
      () => parents.id,
      {
        onDelete: "set null",
      }
    ),

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

    phone: text("phone").notNull(),

    message: text("message")
      .notNull(),

    parsedAction: smsParsedActionEnum("parsed_action"),

    processingStatus: smsProcessingStatusEnum("processing_status")
      .notNull(),

    providerMessageId: text("provider_message_id"),

    metadata: jsonb("metadata"),

    receivedAt: timestamp("received_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),

    processedAt: timestamp("processed_at", {
      withTimezone: true,
    }),
  },
  (table) => ({

    parentConstraint: check(
      "inbound_sms_log_target_chk",
      sql`
        num_nonnulls(
          ${table.leaveRequestId},
          ${table.leaveExtensionId}
        ) = 1
      `
    ),
    
  parentIdIndex: index(
    "inbound_sms_logs_parent_id_idx"
  ).on(table.parentId),

  leaveRequestIdIndex: index(
    "inbound_sms_logs_leave_request_id_idx"
  ).on(table.leaveRequestId),

  leaveExtensionIdIndex: index(
    "inbound_sms_logs_leave_extension_id_idx"
  ).on(table.leaveExtensionId),

  phoneIndex: index(
    "inbound_sms_logs_phone_idx"
  ).on(table.phone),

  processingStatusIndex: index(
    "inbound_sms_logs_processing_status_idx"
  ).on(table.processingStatus),

  receivedAtIndex: index(
    "inbound_sms_logs_received_at_idx"
  ).on(table.receivedAt),
})
);

// =====================================================
// SHEET SYNC LOGS
// =====================================================

export const sheetSyncLogs = pgTable(
  "sheet_sync_logs",
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

    syncEvent: text("sync_event")
      .notNull(),

    syncStatus: sheetSyncStatusEnum("sync_status")
      .notNull(),

    response: text("response"),

    syncedAt: timestamp("synced_at", {
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
    
  leaveRequestIdIndex: index(
    "sheet_sync_logs_leave_request_id_idx"
  ).on(table.leaveRequestId),

  leaveExtensionIdIndex: index(
    "sheet_sync_logs_leave_extension_id_idx"
  ).on(table.leaveExtensionId),

  syncEventIndex: index(
    "sheet_sync_logs_sync_event_idx"    
  ).on(table.syncEvent),

  syncStatusIndex: index(
    "sheet_sync_logs_sync_status_idx"
  ).on(table.syncStatus),

  createdAtIndex: index(
    "sheet_sync_logs_created_at_idx"
  ).on(table.createdAt),

  parentConstraint: check(
      "sheet_sync_log_target_chk",
      sql`
        num_nonnulls(
          ${table.leaveRequestId},
          ${table.leaveExtensionId}
        ) = 1
      `
    ),

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
