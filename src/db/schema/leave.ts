// =====================================================
// LEAVE DOMAIN SCHEMA
// src/db/schema/leave.ts
// =====================================================

import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm/sql/sql";

import { students } from "./academics";
import { roles,users } from "./auth";
import {
  approvalSourceEnum,
  leaveApprovalDecisionEnum,
  leaveCategoryEnum,
  leaveDocumentStatusEnum,
  leaveStatusEnum,
  workflowModeEnum,
} from "./enums";
import { hostels, parents } from "./hostel";
import { workflowDefinitions } from "./workflow";

// =====================================================
// LEAVE TYPES
// =====================================================

export const leaveTypes = pgTable("leave_types", {
  id: uuid("id").defaultRandom().primaryKey(),

  code: text("code")
    .notNull()
    .unique(),

  name: text("name").notNull(),

  category: leaveCategoryEnum("category").notNull(),

  description: text("description"),

  formSchema: jsonb("form_schema").notNull(),

  policyConfig: jsonb("policy_config"),

  notificationConfig: jsonb("notification_config"),

  useGlobalNotificationRules: boolean("use_global_notification_rules")
    .default(true)
    .notNull(),

  requiredDocuments: jsonb("required_documents"),

  uiConfig: jsonb("ui_config"),

  workflowMode: workflowModeEnum("workflow_mode").notNull(),

  defaultWorkflowId: uuid("default_workflow_id").references(
    () => workflowDefinitions.id,
    {
      onDelete: "restrict",
    }
  ),

  allowExtensions: boolean("allow_extensions")
    .default(false)
    .notNull(),

  maxExtensionCount: integer("max_extension_count"),

  isActive: boolean("is_active")
    .default(true)
    .notNull(),

  version: integer("version")
    .default(1)
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
  codeIndex: index(
    "leave_types_code_idx"
  ).on(table.code),

  isActiveIndex: index(
    "leave_types_active_idx"
  ).on(table.isActive),
  workflowModeIndex: index(
    "leave_types_workflow_mode_idx"
  ).on(table.workflowMode),
})
);

// =====================================================
// LEAVE REQUESTS
// =====================================================

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").defaultRandom().primaryKey(),

  requestNumber: text("request_number")
    .notNull()
    .unique(),

  studentId: uuid("student_id")
    .notNull()
    .references(() => students.id, {
      onDelete: "cascade",
    }),

  leaveTypeId: uuid("leave_type_id")
    .notNull()
    .references(() => leaveTypes.id, {
      onDelete: "restrict",
    }),

  reason: text("reason").notNull(),

  status: leaveStatusEnum("status").notNull(),

  currentStepKey: text("current_step_key"),

  currentStepOrder: integer("current_step_order"),

  approvalSnapshot: jsonb("approval_snapshot"),

  policyResult: jsonb("policy_result"),

  startAt: timestamp("start_at", {
    withTimezone: true,
  }).notNull(),

  endAt: timestamp("end_at", {
    withTimezone: true,
  }).notNull(),

  expectedReturnAt: timestamp("expected_return_at", {
    withTimezone: true,
  }),

  actualReturnAt: timestamp("actual_return_at", {
    withTimezone: true,
  }),

  submittedForm: jsonb("submitted_form").notNull(),

  metadata: jsonb("metadata"),

  requestVersion: integer("request_version")
    .default(1)
    .notNull(),

  submittedAt: timestamp("submitted_at", {
    withTimezone: true,
  }).defaultNow().notNull(),

  approvedAt: timestamp("approved_at", {
    withTimezone: true,
  }),

  rejectedAt: timestamp("rejected_at", {
    withTimezone: true,
  }),

  cancelledAt: timestamp("cancelled_at", {
    withTimezone: true,
  }),

  expiredAt: timestamp("expired_at", {
    withTimezone: true,
  }),

  completedAt: timestamp("completed_at", {
    withTimezone: true,
  }),

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

  leaveTypeVersion: integer("leave_type_version").default(1).notNull(),
},
(table) => ({
  requestNumberIndex: index(
    "leave_requests_request_number_idx"
  ).on(table.requestNumber),
  studentIdIndex: index("leave_requests_student_id_idx").on(table.studentId),
  leaveTypeIdIndex: index("leave_requests_leave_type_id_idx").on(table.leaveTypeId),
  statusIndex: index("leave_requests_status_idx").on(table.status),
  requestVersionIndex: index("leave_requests_request_version_idx").on(table.requestVersion),
  startAtIndex: index("leave_requests_start_at_idx").on(table.startAt),
  endAtIndex: index("leave_requests_end_at_idx").on(table.endAt),
  studentDatesIdx: index("lr_student_dates_idx").on(table.studentId, table.startAt, table.endAt),
  statusEndatReturnIdx: index("lr_status_endat_return_idx").on(table.status, table.endAt, table.actualReturnAt),
  statusCreatedIdx: index("lr_status_created_idx").on(table.status, table.createdAt),
}));

// =====================================================
// LEAVE EXTENSIONS
// =====================================================

export const leaveExtensions = pgTable("leave_extensions", {
  id: uuid("id").defaultRandom().primaryKey(),

  leaveRequestId: uuid("leave_request_id")
    .notNull()
    .references(() => leaveRequests.id, {
      onDelete: "cascade",
    }),

  extensionNumber: integer("extension_number")
    .notNull(),

  currentEndAt: timestamp("current_end_at", {
    withTimezone: true,
  }).notNull(),

  requestedEndAt: timestamp("requested_end_at", {
    withTimezone: true,
  }).notNull(),

  reason: text("reason").notNull(),

  status: leaveStatusEnum("status").notNull(),

  currentStepKey: text("current_step_key"),

  currentStepOrder: integer("current_step_order"),

  approvalSnapshot: jsonb("approval_snapshot"),

  policyResult: jsonb("policy_result"),

  submittedForm: jsonb("submitted_form"),

  metadata: jsonb("metadata"),

  submittedAt: timestamp("submitted_at", {
    withTimezone: true,
  }),

  approvedAt: timestamp("approved_at", {
    withTimezone: true,
  }),

  rejectedAt: timestamp("rejected_at", {
    withTimezone: true,
  }),

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
  leaveExtensionNumberUnq: unique(
  "leave_extension_number_unq"
).on(
  table.leaveRequestId,
  table.extensionNumber
),
   leaveRequestIdIndex: index("leave_extensions_leave_request_id_idx").on(table.leaveRequestId),
   extensionNumberIndex: index("leave_extensions_extension_number_idx").on(table.leaveRequestId, table.extensionNumber),
   statusIndex: index("leave_extensions_status_idx").on(table.status),
})
);

// =====================================================
// LEAVE APPROVALS
// =====================================================

export const leaveApprovals = pgTable("leave_approvals", {
  id: uuid("id").defaultRandom().primaryKey(),

  leaveRequestId: uuid("leave_request_id").references(
    () => leaveRequests.id,
    {
      onDelete: "cascade",
    }
  ),

  leaveExtensionId: uuid("leave_extension_id").references(
    () => leaveExtensions.id,
    {
      onDelete: "cascade",
    }
  ),

  stepKey: text("step_key").notNull(),

  stepOrder: integer("step_order").notNull(),

  approverRoleId: uuid("approver_role_id").references(
    () => roles.id,
    {
      onDelete: "restrict",
    }
  ),

  approverUserId: uuid("approver_user_id").references(
    () => users.id,
    {
      onDelete: "set null",
    }
  ),

  approverParentId: uuid("approver_parent_id").references(
    () => parents.id,
    {
      onDelete: "set null",
    }
  ),

  decision: leaveApprovalDecisionEnum("decision").notNull(),

  approvalSource: approvalSourceEnum("approval_source").notNull(),

  comments: text("comments"),

  parentApprovalToken: text("parent_approval_token")
    .unique(),

  parentApprovalOtpHash: text(
    "parent_approval_otp_hash"
  ),

  parentApprovalExpiresAt: timestamp(
    "parent_approval_expires_at",
    { withTimezone: true }
  ),

  parentApprovalVerifiedAt: timestamp(
    "parent_approval_verified_at",
    { withTimezone: true }
  ),

  metadata: jsonb("metadata"),

  actedAt: timestamp("acted_at", {
    withTimezone: true,
  }),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
  },
  (table) => ({
    parentConstraint: check(
      "leave_approval_target_chk",
      sql`
        num_nonnulls(
          ${table.leaveRequestId},
          ${table.leaveExtensionId}
        ) = 1
      `
    ),
    leaveRequestIdIndex: index("la_leave_request_id_idx").on(table.leaveRequestId),
    leaveExtensionIdIndex: index("la_leave_extension_id_idx").on(table.leaveExtensionId),
    approverRoleIdIndex: index("la_approver_role_id_idx").on(table.approverRoleId),
    approverUserIdIndex: index("la_approver_user_id_idx").on(table.approverUserId),
    decisionIndex: index("la_decision_idx").on(table.decision),
    parentApprovalTokenIndex: index("la_parent_token_idx").on(table.parentApprovalToken),
    approverParentIdIndex: index("la_approver_parent_id_idx").on(table.approverParentId),
    parentExpiryIndex: index("la_parent_expiry_idx").on(table.parentApprovalExpiresAt),
    requestDecisionStepIdx: index("la_request_decision_step_idx").on(table.leaveRequestId, table.decision, table.stepOrder),
    extensionDecisionStepIdx: index("la_extension_decision_step_idx").on(table.leaveExtensionId, table.decision, table.stepOrder),
    parentDecisionCreatedIdx: index("la_parent_decision_created_idx").on(table.approverParentId, table.decision, table.createdAt),
  })
);

// =====================================================
// LEAVE DOCUMENTS
// =====================================================

export const leaveDocuments = pgTable("leave_documents", {
  id: uuid("id").defaultRandom().primaryKey(),

  leaveRequestId: uuid("leave_request_id").references(
    () => leaveRequests.id,
    {
      onDelete: "cascade",
    }
  ),

  leaveExtensionId: uuid("leave_extension_id").references(
    () => leaveExtensions.id,
    {
      onDelete: "cascade",
    }
  ),

  uploadedBy: uuid("uploaded_by")
    .notNull()
    .references(() => users.id, {
      onDelete: "restrict",
    }),

  documentType: text("document_type").notNull(),

  documentStatus: leaveDocumentStatusEnum("document_status")
    .default("ACTIVE")
    .notNull(),

  fileName: text("file_name").notNull(),

  fileUrl: text("file_url").notNull(),

  mimeType: text("mime_type"),

  fileSize: integer("file_size"),

  metadata: jsonb("metadata"),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  })
    .defaultNow()
    .notNull(),
},
(table) => ({
  parentConstraint: check(
    "leave_document_target_chk",
    sql`
      num_nonnulls(
        ${table.leaveRequestId},
        ${table.leaveExtensionId}
      ) = 1
    `
  ),
  leaveRequestIdIndex: index("ld_leave_request_id_idx").on(table.leaveRequestId),
  leaveExtensionIdIndex: index("ld_leave_extension_id_idx").on(table.leaveExtensionId),
  uploadedByIndex: index("ld_uploaded_by_idx").on(table.uploadedBy),
  documentTypeIndex: index("ld_document_type_idx").on(table.documentType),
})
);

// =====================================================
// OPERATIONAL PERIODS
// =====================================================

export const operationalPeriods = pgTable(
  "operational_periods",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    hostelId: uuid("hostel_id").references(
      () => hostels.id,
      {
        onDelete: "cascade",
      }
    ),

    name: text("name").notNull(),

    periodType: text("period_type").notNull(),

    startDate: timestamp("start_date", {
      withTimezone: false,
    }).notNull(),

    endDate: timestamp("end_date", {
      withTimezone: false,
    }).notNull(),

    config: jsonb("config").notNull(),

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
    hostelIdIndex: index("op_hostel_id_idx").on(table.hostelId),
    isActiveIndex: index("op_is_active_idx").on(table.isActive),
    periodTypeIndex: index("op_period_type_idx").on(table.periodType),
    datesIndex: index("op_dates_idx").on(table.startDate, table.endDate),
  })
);

// =====================================================
// REFERENCE VALUES
// =====================================================

// workflow_mode
// ----------------
// HOSTEL
// ACADEMIC

// leave_request.status
// ---------------------
// PENDING
// APPROVED
// REJECTED
// CANCELLED
// EXPIRED
// COMPLETED

// leave_approval.decision
// ------------------------
// PENDING
// APPROVED
// REJECTED
// AUTO_APPROVED

// approval_source
// ----------------
// WEB
// SMS
// MANUAL
// SYSTEM

// document_status
// ----------------
// ACTIVE
// REPLACED
// INVALID
// DELETED
