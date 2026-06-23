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

import { roles } from "./auth";
import { approvalMethodEnum } from "./enums";

export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    code: text("code")
      .notNull()
      .unique(),

    name: text("name")
      .notNull(),

    description: text("description"),

    version: integer("version")
      .default(1)
      .notNull(),

    isActive: boolean("is_active")
      .default(true)
      .notNull(),

    metadata: jsonb("metadata"),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),

    updatedAt: timestamp(
      "updated_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    codeIndex: index(
      "workflow_definition_code_idx"
    ).on(table.code),

    activeIndex: index(
      "workflow_definition_active_idx"
    ).on(table.isActive),
  })
);

export const workflowSteps = pgTable(
  "workflow_steps",
  {
    id: uuid("id")
      .defaultRandom()
      .primaryKey(),

    workflowDefinitionId: uuid(
      "workflow_definition_id"
    )
      .notNull()
      .references(
        () => workflowDefinitions.id,
        {
          onDelete: "cascade",
        }
      ),

    stepKey: text("step_key")
      .notNull(),

    stepOrder: integer("step_order")
      .notNull(),

    approverRoleId: uuid(
      "approver_role_id"
    ).references(
      () => roles.id,
      {
        onDelete: "restrict",
      }
    ),

    isParentApproval: boolean(
      "is_parent_approval"
    )
      .default(false)
      .notNull(),

    approvalMethod: approvalMethodEnum(
      "approval_method"
    ),

    isRequired: boolean(
      "is_required"
    )
      .default(true)
      .notNull(),

    metadata: jsonb("metadata"),

    createdAt: timestamp(
      "created_at",
      { withTimezone: true }
    )
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    workflowIdIndex: index(
      "workflow_steps_workflow_id_idx"
    ).on(table.workflowDefinitionId),

    approverRoleIndex: index(
      "workflow_steps_role_idx"
    ).on(table.approverRoleId),

    stepOrderUnique: unique(
      "workflow_step_order_unq"
    ).on(
      table.workflowDefinitionId,
      table.stepOrder
    ),

    stepKeyUnique: unique(
      "workflow_step_key_unq"
    ).on(
      table.workflowDefinitionId,
      table.stepKey
    ),
  })
);