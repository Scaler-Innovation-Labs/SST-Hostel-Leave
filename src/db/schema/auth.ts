// =====================================================
// AUTH DOMAIN SCHEMA
// src/db/schema/auth.ts
// =====================================================

import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { genderEnum } from "./enums";
import { hostels } from "./hostel";
// =====================================================
// USERS
// =====================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  clerkId: text("clerk_id").unique(),

  hostelId: uuid("hostel_id").references(() => hostels.id, { onDelete: "set null" }),

  fullName: text("full_name").notNull(),

  email: text("email").unique(),

  phone: text("phone").unique(),

  /** Slack member id (U...) or user-group id (S...) used for DMs/mentions. */
  slackId: text("slack_id"),

  gender: genderEnum("gender"),

  profileImageUrl: text("profile_image_url"),

  isActive: boolean("is_active")
    .default(true)
    .notNull(),

  lastLoginAt: timestamp("last_login_at", {
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

  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
  }),

  
},
 (table) => ({
    clerkIdIndex: index("users_clerk_id_idx").on(table.clerkId),

    emailIndex: index("users_email_idx").on(table.email),

    hostelIdIndex: index("users_hostel_id_idx").on(table.hostelId),
  })
);

// =====================================================
// ROLES
// =====================================================

export const roles = pgTable("roles", {
  id: uuid("id").defaultRandom().primaryKey(),

  code: text("code")
    .notNull()
    .unique(),

  name: text("name").notNull(),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

// =====================================================
// USER ROLES
// =====================================================

export const userRoles = pgTable(
  "user_roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, {
        onDelete: "cascade",
      }),

    /**
     * Optional scope limiting this role assignment's visibility,
     * e.g. HOSTEL / DEPARTMENT / CAMPUS. Null means unrestricted (ALL).
     */
    scopeType: text("scope_type"),

    /** Id of the scope entity (hostel id, department id, campus id...). */
    scopeId: uuid("scope_id"),

    /** User who assigned this role (audit trail). */
    assignedBy: uuid("assigned_by").references(() => users.id, {
      onDelete: "set null",
    }),

    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // A user may hold the same role multiple times with different scopes
    // (e.g. ADMIN over Hostel A and Hostel B).
    userRoleScopeUnq: uniqueIndex("user_roles_user_role_scope_unq").on(
      table.userId,
      table.roleId,
      table.scopeType,
      table.scopeId
    ),
  })
);

// =====================================================
// ROLE CODES (REFERENCE)
// =====================================================

// SUPER_ADMIN
// ADMIN
// POC
// STUDENT
// parent(if required)