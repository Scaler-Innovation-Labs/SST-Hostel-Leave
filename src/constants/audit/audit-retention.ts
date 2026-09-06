// =====================================================
// AUDIT RETENTION POLICY
// src/constants/audit/audit-retention.ts
// =====================================================

/**
 * Retention classes determine how long audit rows are kept:
 *
 * - CONFIG_MUTATION: policy/workflow/leave-type/reference-data changes.
 *   Kept forever (expiresAt NULL). What is kept is the record() metadata,
 *   not full oldData/newData snapshots (those columns are reserved).
 * - STATE_TRANSITION: leave submitted/approved/rejected, QR scans, movement.
 *   Event facts are enough; expires after AUDIT_STATE_TRANSITION_YEARS.
 * - USER_ACTION: login/logout. Minimal facts; expires after
 *   AUDIT_USER_ACTION_YEARS.
 */
export const AUDIT_RETENTION_CLASS = {
  CONFIG_MUTATION: "CONFIG_MUTATION",
  STATE_TRANSITION: "STATE_TRANSITION",
  USER_ACTION: "USER_ACTION",
} as const;

export type AuditRetentionClass =
  (typeof AUDIT_RETENTION_CLASS)[keyof typeof AUDIT_RETENTION_CLASS];

export const AUDIT_STATE_TRANSITION_YEARS = 2;
export const AUDIT_USER_ACTION_YEARS = 1;

/** Entity types whose mutations are configuration history — keep forever. */
const CONFIG_ENTITY_TYPES = new Set([
  "POLICY",
  "WORKFLOW",
  "LEAVE_TYPE",
  "USER",
  "STUDENT",
  "HOSTEL",
  "DEPARTMENT",
  "ACADEMIC_GROUP",
  "NOTIFICATION_TEMPLATE",
  "NOTIFICATION_RULE",
]);

/** Actions that are pure user sessions — shortest retention. */
const USER_ACTIONS = new Set(["LOGIN", "LOGOUT"]);

/** Derive the retention class from the action/entity pair being audited. */
export function resolveAuditRetentionClass(
  entityType: string,
  action: string
): AuditRetentionClass {
  if (USER_ACTIONS.has(action)) return AUDIT_RETENTION_CLASS.USER_ACTION;
  if (CONFIG_ENTITY_TYPES.has(entityType))
    return AUDIT_RETENTION_CLASS.CONFIG_MUTATION;
  return AUDIT_RETENTION_CLASS.STATE_TRANSITION;
}

/** Expiry date for a retention class; NULL = keep forever. */
export function resolveAuditExpiresAt(
  retentionClass: AuditRetentionClass,
  from: Date = new Date()
): Date | null {
  const years =
    retentionClass === AUDIT_RETENTION_CLASS.STATE_TRANSITION
      ? AUDIT_STATE_TRANSITION_YEARS
      : retentionClass === AUDIT_RETENTION_CLASS.USER_ACTION
        ? AUDIT_USER_ACTION_YEARS
        : null;

  if (years === null) return null;

  const expiresAt = new Date(from);
  expiresAt.setFullYear(expiresAt.getFullYear() + years);
  return expiresAt;
}
