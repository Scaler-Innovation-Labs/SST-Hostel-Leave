// =====================================================
// HOSTEL DOMAIN SCHEMA
// src/db/schema/hostel.ts
// =====================================================

import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  time,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { students } from "./academics";

// =====================================================
// HOSTELS
// =====================================================

export const hostels = pgTable("hostels", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: text("name").notNull(),

  code: text("code")
    .notNull()
    .unique(),

  capacity: integer("capacity"),

  curfewStartTime: time("curfew_start_time"),

  curfewEndTime: time("curfew_end_time"),

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

  deletedAt: timestamp("deleted_at", {
    withTimezone: true,
  }),
},
(table) => ({
  codeIndex: index("hostels_code_idx").on(table.code),

  isActiveIndex: index("hostels_active_idx").on(table.isActive),
})
);

// =====================================================
// PARENTS
// =====================================================

export const parents = pgTable(
  "parents",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, {
        onDelete: "cascade",
      }),

    name: text("name").notNull(),

    phone: text("phone").notNull(),

    email: text("email"),

    relationship: text("relationship").notNull(),

    isPrimary: boolean("is_primary")
      .default(false)
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
    studentIdIndex: index(
      "parents_student_id_idx"
    ).on(table.studentId),

    phoneIndex: index(
      "parents_phone_idx"
    ).on(table.phone),

    studentPhoneUnique: unique(
      "parent_student_phone_unq"
    ).on(table.studentId, table.phone),
  })
);