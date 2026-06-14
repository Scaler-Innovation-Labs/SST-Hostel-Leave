// =====================================================
// POLICY DOMAIN SCHEMA
// src/db/schema/policy.ts
// =====================================================

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { policyTypeEnum } from "./enums";
import { departments } from "./academics";
import { hostels } from "./hostel";
import { leaveTypes } from "./leave";

// =====================================================
// POLICIES
// =====================================================

export const policies = pgTable("policies", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull().unique(),

  policyType: policyTypeEnum("policy_type").notNull(),

  priority: integer("priority")
    .default(0)
    .notNull(),

  leaveTypeId: uuid("leave_type_id").references(
    () => leaveTypes.id,
    {
      onDelete: "cascade",
    }
  ),

  hostelId: uuid("hostel_id").references(
    () => hostels.id,
    {
      onDelete: "cascade",
    }
  ),

  departmentId: uuid("department_id").references(
    () => departments.id,
    {
      onDelete: "cascade",
    }
  ),

  batchYear: integer("batch_year"),

  config: jsonb("config").notNull(),

  isActive: boolean("is_active")
    .default(true)
    .notNull(),

  startsAt: timestamp("starts_at", {
    withTimezone: true,
  }),

  endsAt: timestamp("ends_at", {
    withTimezone: true,
  }),

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
  policyTypeIndex: index(
    "policies_policy_type_idx"
  ).on(table.policyType),

  leaveTypeIdIndex: index(
    "policies_leave_type_id_idx"
  ).on(table.leaveTypeId),

  hostelIdIndex: index(
    "policies_hostel_id_idx"
  ).on(table.hostelId),

  departmentIdIndex: index(
    "policies_department_id_idx"
  ).on(table.departmentId),

  batchYearIndex: index(
    "policies_batch_year_idx"
  ).on(table.batchYear),

  isActiveIndex: index(
    "policies_is_active_idx"
  ).on(table.isActive),

  priorityIndex: index(
    "policies_priority_idx"
  ).on(table.priority),
})
);
  
// =====================================================
// POLICY TYPES (REFERENCE)
// =====================================================

// MAX_DAYS
// BLOCK_DURING_PERIOD
// RESTRICT_BATCH
// REQUIRE_PARENT_APPROVAL
// CURFEW_RESTRICTION
// MAX_EXTENSION_COUNT

// =====================================================
// CONFIG EXAMPLES
// =====================================================

// MAX_DAYS
// ----------
// {
//   "maxDays": 7
// }

// BLOCK_DURING_PERIOD
// --------------------
// {
//   "blockedPeriods": ["MID_EXAMS"]
// }

// RESTRICT_BATCH
// ----------------
// {
//   "blockedBatchYears": [2027]
// }

// CURFEW_RESTRICTION
// -------------------
// {
//   "latestReturnTime": "20:00"
// }
