export const APPROVAL_OVERRIDE_TYPE = {
  /** An admin/super admin advanced the step through the override endpoint. */
  ADMIN: "ADMIN_OVERRIDE",
  /** A staff approver approved while the parent step was still pending. */
  PARENT: "PARENT_OVERRIDE",
} as const;

export type ApprovalOverrideType =
  (typeof APPROVAL_OVERRIDE_TYPE)[keyof typeof APPROVAL_OVERRIDE_TYPE];
