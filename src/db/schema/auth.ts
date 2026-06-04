// =====================================================
// AUTH DOMAIN SCHEMA
// src/db/schema/auth.ts
// =====================================================

import {
  boolean,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { genderEnum } from "./enums";
// =====================================================
// USERS
// =====================================================

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  clerkId: text("clerk_id").unique(),

  hostelId: uuid("hostel_id"),

  fullName: text("full_name").notNull(),

  email: text("email").unique(),

  phone: text("phone").unique(),

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

    assignedAt: timestamp("assigned_at", {
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    pk: primaryKey({
      columns: [table.userId, table.roleId],
    }),
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