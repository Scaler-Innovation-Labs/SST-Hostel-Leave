import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";
import { leaveRequests } from "./leave";

export const leaveQuestions = pgTable("leave_questions", {
  id: uuid("id").defaultRandom().primaryKey(),

  leaveRequestId: uuid("leave_request_id")
    .notNull()
    .references(() => leaveRequests.id, { onDelete: "cascade" }),

  askedBy: uuid("asked_by")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  askedByRole: text("asked_by_role").notNull(),

  askedByName: text("asked_by_name").notNull(),

  question: text("question").notNull(),

  answer: text("answer"),

  status: text("status", { enum: ["pending", "answered"] }).notNull().default("pending"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),

  answeredAt: timestamp("answered_at", { withTimezone: true }),
});

export type LeaveQuestion = typeof leaveQuestions.$inferSelect;
export type NewLeaveQuestion = typeof leaveQuestions.$inferInsert;
