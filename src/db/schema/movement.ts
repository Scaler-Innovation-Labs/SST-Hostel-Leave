// =====================================================
// MOVEMENT DOMAIN SCHEMA
// src/db/schema/movement.ts
// =====================================================

import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { students } from "./academics";
import { users } from "./auth";
import {
  movementEventEnum,
  movementMethodEnum,
  qrScanResultEnum,
  qrScanTypeEnum,
  qrStatusEnum,
  qrTypeEnum,
} from "./enums";
import { leaveRequests } from "./leave";

// =====================================================
// MOVEMENT STATES
// =====================================================

export const movementStates = pgTable("movement_states", {
  code: text("code").primaryKey(),

  name: text("name").notNull(),

  isTerminal: boolean("is_terminal")
    .default(false)
    .notNull(),

  metadata: jsonb("metadata"),
});

// =====================================================
// QR PASSES
// =====================================================

export const qrPasses = pgTable("qr_passes", {
  id: uuid("id").defaultRandom().primaryKey(),

  leaveRequestId: uuid("leave_request_id")
    .notNull()
    .references(() => leaveRequests.id, {
      onDelete: "cascade",
    }),

  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, {
      onDelete: "cascade",
    }),

  qrType: qrTypeEnum("qr_type").notNull(),

  tokenHash: text("token_hash")
    .notNull()
    .unique(),

  status: qrStatusEnum("status").notNull(),

  generatedAt: timestamp("generated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  expiresAt: timestamp("expires_at", {
    withTimezone: true,
  }),

  firstScanAt: timestamp("first_scan_at", {
    withTimezone: true,
  }),

  closedAt: timestamp("closed_at", {
    withTimezone: true,
  }),

  invalidatedAt: timestamp("invalidated_at", {
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
  leaveRequestIdQrTypeUnique: unique("qr_pass_leave_request_qr_type_unq")
  .on(table.leaveRequestId, table.qrType),

  leaveRequestIdIndex: index(
    "qr_pass_leave_request_id_idx"
  ).on(table.leaveRequestId),

  studentIdIndex: index(
    "qr_pass_student_id_idx"
  ).on(table.studentId),

  statusIndex: index(
    "qr_pass_status_idx"
  ).on(table.status),
}));

// =====================================================
// QR SCAN LOGS
// =====================================================

export const qrScanLogs = pgTable("qr_scan_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  qrPassId: uuid("qr_pass_id").references(() => qrPasses.id, {
    onDelete: "set null",
  }),

  scannedBy: uuid("scanned_by").references(() => users.id, {
    onDelete: "set null",
  }),

  scanType: qrScanTypeEnum("scan_type").notNull(),

  scanResult: qrScanResultEnum("scan_result").notNull(),

  failureReason: text("failure_reason"),

  metadata: jsonb("metadata"),

  scannedAt: timestamp("scanned_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
},
(table) => ({
  qrPassIdIndex: index(
    "qr_scan_logs_qr_pass_id_idx"
  ).on(table.qrPassId),

  scannedByIndex: index(
    "qr_scan_logs_scanned_by_idx"
  ).on(table.scannedBy),
  })
  );

// =====================================================
// MOVEMENT EVENTS
// =====================================================

export const movementEvents = pgTable("movement_events", {
  id: uuid("id").defaultRandom().primaryKey(),

  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, {
      onDelete: "cascade",
    }),

  leaveRequestId: uuid("leave_request_id").references(
    () => leaveRequests.id,
    {
      onDelete: "set null",
    }
  ),

  qrPassId: uuid("qr_pass_id").references(() => qrPasses.id, {
    onDelete: "set null",
  }),

  eventType: movementEventEnum("event_type").notNull(),

  fromState: text("from_state").references(
    () => movementStates.code,
    {
      onDelete: "restrict",
    }
  ),

  toState: text("to_state").references(
    () => movementStates.code,
    {
      onDelete: "restrict",
    }
  ),

  movementMethod: movementMethodEnum("movement_method").notNull(),

  isManualOverride: boolean("is_manual_override")
    .default(false)
    .notNull(),

  overrideReason: text("override_reason"),

  metadata: jsonb("metadata"),

  recordedBy: uuid("recorded_by").references(() => users.id, {
    onDelete: "set null",
  }),

  occurredAt: timestamp("occurred_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
},
(table) => ({
  studentIdIndex: index(
    "movement_events_student_id_idx"
  ).on(table.studentId),

  leaveRequestIdIndex: index(
    "movement_events_leave_request_id_idx"
  ).on(table.leaveRequestId),

  occurredAtIndex: index(
    "movement_events_occurred_at_idx"
  ).on(table.occurredAt),

  eventTypeIndex: index(
    "movement_events_event_type_idx"
  ).on(table.eventType),
  })
  );

// =====================================================
// MOVEMENT STATE CODES (REFERENCE)
// =====================================================

// IN_HOSTEL
// APPROVED_LEAVE
// CHECKED_OUT
// OUTSIDE_HOSTEL
// RETURNED
// OVERDUE

// =====================================================
// EVENT TYPES (REFERENCE)
// =====================================================

// LEAVE_APPROVED
// EXIT_HOSTEL
// ENTER_HOSTEL
// AUTO_OVERDUE
// MANUAL_RETURN
// QR_INVALIDATED
