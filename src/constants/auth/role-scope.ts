/**
 * Scope types for scoped role assignments (user_roles.scope_type).
 *
 * A role assignment with a scope limits the user's visibility/authority
 * to the referenced entity. A role assignment without a scope means the
 * user has unrestricted access for that role (ALL).
 */
export const ROLE_SCOPE_TYPE = {
  HOSTEL: "HOSTEL",
  DEPARTMENT: "DEPARTMENT",
  CAMPUS: "CAMPUS",
} as const;

export type RoleScopeType =
  (typeof ROLE_SCOPE_TYPE)[keyof typeof ROLE_SCOPE_TYPE];

export const ROLE_SCOPE_TYPES: readonly string[] = Object.values(ROLE_SCOPE_TYPE);
