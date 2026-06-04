// =====================================================
// DATABASE ENUMS
// src/db/schema/enums.ts
// =====================================================

import { pgEnum } from "drizzle-orm/pg-core";

// =====================================================
// AUTH
// =====================================================

export const genderEnum = pgEnum("gender", [
  "MALE",
  "FEMALE",
  "OTHER",
]);

// =====================================================
// LEAVE
// =====================================================

export const workflowModeEnum = pgEnum(
  "workflow_mode",
  [
    "HOSTEL",
    "ACADEMIC",
  ]
);

export const leaveStatusEnum = pgEnum(
  "leave_status",
  [
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "EXPIRED",
    "COMPLETED",
  ]
);

export const leaveApprovalDecisionEnum =
  pgEnum(
    "leave_approval_decision",
    [
      "PENDING",
      "APPROVED",
      "REJECTED",
      "AUTO_APPROVED",
    ]
  );

export const approvalSourceEnum = pgEnum(
  "approval_source",
  [
    "WEB",
    "SMS",
    "MANUAL",
    "SYSTEM",
  ]
);

export const leaveDocumentStatusEnum =
  pgEnum(
    "leave_document_status",
    [
      "ACTIVE",
      "REPLACED",
      "INVALID",
      "DELETED",
    ]
  );

export const leaveCategoryEnum = pgEnum(
  "leave_category",
  [
    "HOME_PASS",
    "MEDICAL",
    "LOCAL_OUTING",
    "NIGHT_OUT",
    "ACADEMIC",
  ]
);

// =====================================================
// MOVEMENT
// =====================================================

export const movementStateEnum = pgEnum(
  "movement_state",
  [
    "IN_HOSTEL",
    "APPROVED_LEAVE",
    "CHECKED_OUT",
    "OUTSIDE_HOSTEL",
    "RETURNED",
    "OVERDUE",
  ]
);

export const movementEventEnum = pgEnum(
  "movement_event",
  [
    "LEAVE_APPROVED",
    "EXIT_HOSTEL",
    "ENTER_HOSTEL",
    "AUTO_OVERDUE",
    "MANUAL_RETURN",
    "QR_INVALIDATED",
  ]
);

export const movementMethodEnum = pgEnum(
  "movement_method",
  [
    "QR",
    "MANUAL",
    "SYSTEM",
  ]
);

// =====================================================
// QR
// =====================================================

export const qrStatusEnum = pgEnum(
  "qr_status",
  [
    "ACTIVE",
    "USED",
    "EXPIRED",
    "INVALIDATED",
  ]
);

export const qrTypeEnum = pgEnum(
  "qr_type",
  [
    "LEAVE_EXIT",
    "LEAVE_RETURN",
  ]
);

export const qrScanTypeEnum = pgEnum(
  "qr_scan_type",
  [
    "EXIT_SCAN",
    "RETURN_SCAN",
  ]
);

export const qrScanResultEnum = pgEnum(
  "qr_scan_result",
  [
    "SUCCESS",
    "FAILED",
  ]
);

// =====================================================
// NOTIFICATIONS
// =====================================================

export const notificationChannelEnum =
  pgEnum(
    "notification_channel",
    [
      "EMAIL",
      "SMS",
      "PUSH",
      "WEBHOOK",
    ]
  );

export const notificationDeliveryStatusEnum =
  pgEnum(
    "notification_delivery_status",
    [
      "PENDING",
      "SENT",
      "FAILED",
      "DELIVERED",
      "READ",
    ]
  );

export const notificationEventEnum =
  pgEnum(
    "notification_event",
    [
      "LEAVE_SUBMITTED",
      "LEAVE_APPROVED",
      "LEAVE_REJECTED",
      "LEAVE_EXTENSION_REQUESTED",
      "LEAVE_EXTENSION_APPROVED",
      "LEAVE_EXTENSION_REJECTED",
      "LEAVE_OVERDUE",
      "QR_GENERATED",
      "QR_INVALIDATED",
    ]
  );

// =====================================================
// SMS
// =====================================================

export const smsParsedActionEnum =
  pgEnum(
    "sms_parsed_action",
    [
      "APPROVE",
      "REJECT",
      "UNKNOWN",
    ]
  );

export const smsProcessingStatusEnum =
  pgEnum(
    "sms_processing_status",
    [
      "RECEIVED",
      "PARSED",
      "PROCESSED",
      "FAILED",
    ]
  );

// =====================================================
// SHEET SYNC
// =====================================================

export const sheetSyncStatusEnum =
  pgEnum(
    "sheet_sync_status",
    [
      "PENDING",
      "SUCCESS",
      "FAILED",
    ]
  );

// =====================================================
// POLICY
// =====================================================

export const policyTypeEnum = pgEnum(
  "policy_type",
  [
    "MAX_DAYS",
    "BLOCK_DURING_PERIOD",
    "RESTRICT_BATCH",
    "REQUIRE_PARENT_APPROVAL",
    "CURFEW_RESTRICTION",
    "MAX_EXTENSION_COUNT",
  ]
);

// =====================================================
// AUDIT
// =====================================================

export const auditEntityTypeEnum =
  pgEnum(
    "audit_entity_type",
    [
      "LEAVE_REQUEST",
      "LEAVE_EXTENSION",
      "LEAVE_APPROVAL",
      "QR_PASS",
      "MOVEMENT_EVENT",
      "POLICY",
      "USER",
      "STUDENT",
    ]
  );

export const auditActionEnum = pgEnum(
  "audit_action",
  [
    "CREATE",
    "UPDATE",
    "DELETE",
    "APPROVE",
    "REJECT",
    "CANCEL",
    "INVALIDATE",
    "OVERRIDE",
    "LOGIN",
    "LOGOUT",
  ]
);

// =====================================================
// HOSTEL
// =====================================================

export const hostelGenderEnum = pgEnum(
  "hostel_gender",
  [
    "MALE",
    "FEMALE",
    "MIXED",
  ]
);