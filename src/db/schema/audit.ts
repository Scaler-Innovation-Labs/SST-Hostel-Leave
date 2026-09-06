// =====================================================
// AUDIT DOMAIN SCHEMA
// src/db/schema/audit.ts
// =====================================================

import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import {
  auditActionEnum,
  auditEntityTypeEnum,
} from "./enums";

// =====================================================
// AUDIT LOGS
// =====================================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),

  actorUserId: uuid("actor_user_id").references(
    () => users.id,
    {
      onDelete: "set null",
    }
  ),

  entityType: auditEntityTypeEnum("entity_type")
    .notNull(),

  entityId: uuid("entity_id")
    .notNull(),

  action: auditActionEnum("action")
    .notNull(),

  // Retention class determines what is kept and for how long:
  // - "CONFIG_MUTATION" = policy/workflow/leave-type changes (keep metadata forever)
  // - "STATE_TRANSITION" = leave submitted/approved/rejected, QR scans (minimal facts, expires after 2 years)
  // - "USER_ACTION" = login/logout (minimal facts, expires after 1 year)
  retentionClass: text("retention_class").notNull().default("STATE_TRANSITION"),

  // Reserved columns (oldData/newData snapshots, ipAddress/userAgent) are
  // intentionally unwritten today: auditService.record persists action +
  // entity + actor + metadata only. If forensics needs diffs or request
  // attribution, populate these (plumbing actor request context through
  // services) rather than overloading metadata.
  oldData: jsonb("old_data"),

  newData: jsonb("new_data"),

  metadata: jsonb("metadata"),

  ipAddress: text("ip_address"),

  userAgent: text("user_agent"),

  // When this audit log can be deleted (NULL = keep forever for CONFIG_MUTATION).
  // Set by audit service based on retentionClass.
  expiresAt: timestamp("expires_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
},
(table) => ({
  entityLookupIndex: index(
    "audit_entity_lookup_idx"
  ).on(
    table.entityType,
    table.entityId
  ),

  actorUserIdIndex: index(
  "audit_actor_user_id_idx"
).on(table.actorUserId),

  actionIndex: index(
  "audit_action_idx"
).on(table.action),

  createdAtIndex: index(
  "audit_created_at_idx"
).on(table.createdAt),

  // For retention cleanup jobs
  expiresAtIndex: index(
    "audit_expires_at_idx"
  ).on(table.expiresAt),
})
);

// =====================================================
// ENTITY TYPES (REFERENCE)
// =====================================================

// LEAVE_REQUEST
// LEAVE_EXTENSION
// LEAVE_APPROVAL
// QR_PASS
// MOVEMENT_EVENT
// POLICY
// USER
// STUDENT

// =====================================================
// ACTION TYPES (REFERENCE)
// =====================================================

// CREATE
// UPDATE
// DELETE
// APPROVE
// REJECT
// CANCEL
// INVALIDATE
// OVERRIDE
// LOGIN
// LOGOUT
