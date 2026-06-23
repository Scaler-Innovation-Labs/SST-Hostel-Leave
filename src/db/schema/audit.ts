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

  oldData: jsonb("old_data"),

  newData: jsonb("new_data"),

  metadata: jsonb("metadata"),

  ipAddress: text("ip_address"),

  userAgent: text("user_agent"),

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
