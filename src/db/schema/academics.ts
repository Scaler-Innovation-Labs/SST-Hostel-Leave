// =====================================================
// ACADEMICS DOMAIN SCHEMA
// src/db/schema/academics.ts
// =====================================================

import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { movementStates } from "./movement";

// =====================================================
// DEPARTMENTS
// =====================================================

export const departments = pgTable("departments", {
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

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
});

// =====================================================
// ACADEMIC GROUPS
// =====================================================

export const academicGroups = pgTable(
  "academic_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    departmentId: uuid("department_id")
      .notNull()
      .references(() => departments.id, {
        onDelete: "restrict",
      }),

    batchYear: integer("batch_year").notNull(),

    groupCode: text("group_code"),

    name: text("name").notNull(),

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
    academicGroupUnique: unique().on(
      table.departmentId,
      table.batchYear,
      table.groupCode
    ),
  })
);

// =====================================================
// STUDENTS
// =====================================================

export const students = pgTable("students", {
  id: uuid("id").defaultRandom().primaryKey(),

  userId: uuid("user_id")
    .notNull()
    .unique()
    .references(() => users.id, {
      onDelete: "cascade",
    }),

  academicGroupId: uuid("academic_group_id")
    .notNull()
    .references(() => academicGroups.id, {
      onDelete: "restrict",
    }),

  roomNumber: text("room_number"),

  rollNumber: text("roll_number")
    .notNull()
    .unique(),

  currentLocationState: text("current_location_state")
    .notNull()
    .references(() => movementStates.code, {
      onDelete: "restrict",
    }),

  joinedAt: date("joined_at"),

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
    userIdIndex: index("student_user_id_idx").on(table.userId),
    academicGroupIdIndex: index("student_academic_group_id_idx").on(table.academicGroupId),
    currentLocationStateIndex: index("students_cur_loc_state_idx").on(table.currentLocationState),
  })
);