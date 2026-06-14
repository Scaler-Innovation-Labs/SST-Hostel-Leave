export const ROLES = {
  STUDENT: "STUDENT",
  POC: "POC",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
  GUARD: "GUARD",
} as const;

export type Role =
  (typeof ROLES)[keyof typeof ROLES];

const ROLE_VALUES: readonly string[] = Object.values(ROLES);

export function isRole(value: string): value is Role {
  return ROLE_VALUES.includes(value);
}

const ROLE_HIERARCHY: Record<Role, number> = {
  GUARD: 0,
  STUDENT: 0,
  POC: 1,
  ADMIN: 2,
  SUPER_ADMIN: 3,
};

export function canRoleApprove(approverRoles: Role[], requiredRoleCode: string): boolean {
  if (!isRole(requiredRoleCode)) return false;

  const requiredLevel = ROLE_HIERARCHY[requiredRoleCode];

  return approverRoles.some((role) => ROLE_HIERARCHY[role] >= requiredLevel);
}
