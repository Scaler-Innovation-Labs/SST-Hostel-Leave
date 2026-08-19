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
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { departments } from "./academics";
import { users } from "./auth";
import { policyTypeEnum } from "./enums";
import { hostels } from "./hostel";
import { leaveRequests, leaveTypes } from "./leave";

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
// POLICY VERSIONS (immutable configuration history)
// =====================================================

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    policyId: uuid("policy_id")
      .notNull()
      .references(() => policies.id, {
        onDelete: "restrict",
      }),

    /** Monotonically increasing per policy. A new row is created only when
        the policy actually changes; existing rows are never mutated. */
    version: integer("version").notNull(),

    name: text("name").notNull(),

    policyType: policyTypeEnum("policy_type").notNull(),

    priority: integer("priority")
      .default(0)
      .notNull(),

    leaveTypeId: uuid("leave_type_id").references(
      () => leaveTypes.id,
      {
        onDelete: "set null",
      }
    ),

    hostelId: uuid("hostel_id").references(
      () => hostels.id,
      {
        onDelete: "set null",
      }
    ),

    departmentId: uuid("department_id").references(
      () => departments.id,
      {
        onDelete: "set null",
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

    createdBy: uuid("created_by").references(
      () => users.id,
      {
        onDelete: "set null",
      }
    ),

    createdAt: timestamp("created_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    policyVersionUnq: unique(
      "policy_version_unq"
    ).on(
      table.policyId,
      table.version
    ),
    policyIdIndex: index(
      "pov_policy_id_idx"
    ).on(table.policyId),
    leaveTypeIdIndex: index(
      "pov_leave_type_id_idx"
    ).on(table.leaveTypeId),
    hostelIdIndex: index(
      "pov_hostel_id_idx"
    ).on(table.hostelId),
  })
);

// =====================================================
// POLICY EVALUATIONS (what actually happened per leave)
// =====================================================

export const policyEvaluations = pgTable(
  "policy_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    leaveRequestId: uuid("leave_request_id")
      .notNull()
      .references(() => leaveRequests.id, {
        onDelete: "cascade",
      }),

    policyId: uuid("policy_id").references(
      () => policies.id,
      {
        onDelete: "set null",
      }
    ),

    /** The immutable policy version evaluated for this leave. */
    policyVersionId: uuid("policy_version_id").references(
      () => policyVersions.id,
      {
        onDelete: "restrict",
      }
    ),

    passed: boolean("passed").notNull(),

    /** The restriction/requirement message when the policy failed. */
    message: text("message"),

    evaluatedAt: timestamp("evaluated_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    leaveRequestIdIndex: index(
      "pe_leave_request_id_idx"
    ).on(table.leaveRequestId),
    policyVersionIdIndex: index(
      "pe_policy_version_id_idx"
    ).on(table.policyVersionId),
  })
);
  
// =====================================================
// POLICY TYPES
// =====================================================

// Generic types: FORM_VALIDATION, ELIGIBILITY, LIMIT,
//   WORKFLOW, DOCUMENT_REQUIREMENT, QR_RULE, TIME_WINDOW,
//   FEATURE_FLAG
// Each uses config.type to specify the rule variant.

// =====================================================
// CONFIG EXAMPLES
// =====================================================

// FORM_VALIDATION | type: WITHIN_DAYS
// ------------------------------------
// {
//   "type": "WITHIN_DAYS",
//   "field": "examDate",
//   "maxDays": 30,
//   "message": "Exam date must be within 30 days from today."
// }

// FORM_VALIDATION | type: FIELD_RESTRICTION
// -------------------------------------------
// {
//   "type": "FIELD_RESTRICTION",
//   "fieldRestrictions": [{ "fieldKey": "destination", "disallowedValues": [...] }]
// }

// LIMIT | type: MAX_DAYS
// ------------------------
// {
//   "type": "MAX_DAYS",
//   "maxDays": 7
// }

// LIMIT | type: MAX_EXTENSION_COUNT
// -----------------------------------
// {
//   "type": "MAX_EXTENSION_COUNT",
//   "maxExtensionCount": 2
// }

// ELIGIBILITY | type: BATCH_RESTRICTION
// ---------------------------------------
// {
//   "type": "BATCH_RESTRICTION",
//   "blockedBatchYears": [2027]
// }

// ELIGIBILITY | type: PARENT_APPROVAL_REQUIRED
// ----------------------------------------------
// {
//   "type": "PARENT_APPROVAL_REQUIRED"
// }

// TIME_WINDOW | type: BLOCKED_PERIOD
// ------------------------------------
// {
//   "type": "BLOCKED_PERIOD",
//   "blockedPeriods": ["MID_EXAMS"]
// }

// TIME_WINDOW | type: CURFEW
// ----------------------------
// {
//   "type": "CURFEW",
//   "latestReturnTime": "20:00"
// }

// TIME_WINDOW | type: LEAVE_EXPIRY
// ----------------------------------
// {
//   "type": "LEAVE_EXPIRY",
//   "expireAfterHours": 24
// }

// FEATURE_FLAG
// --------------
// {
//   "type": "some_flag"
// }
