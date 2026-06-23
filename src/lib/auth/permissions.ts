export const PERMISSIONS = {
  CREATE_LEAVE: "CREATE_LEAVE",
  APPROVE_LEAVE: "APPROVE_LEAVE",
  MANAGE_USERS: "MANAGE_USERS",
} as const;

import { ROUTES } from "@/constants/routes";

import { type Role,ROLES } from "./roles";

export type Permission =
  | "dashboard:read"
  | "leaves:read"
  | "leaves:write"
  | "qr:read"
  | "qr:write"
  | "workflow:read"
  | "workflow:write"
  | "users:read"
  | "users:write"
  | "analytics:read"
  | "settings:read"
  | "settings:write";

export const ROLE_PERMISSIONS: Record<
  Role,
  Permission[]
> = {
  [ROLES.GUARD]: [
    "qr:read",
    "qr:write",
  ],
  [ROLES.STUDENT]: [
    "dashboard:read",
    "leaves:read",
    "leaves:write",
    "qr:read",
  ],
  [ROLES.POC]: [
    "dashboard:read",
    "leaves:read",
    "workflow:read",
  ],
  [ROLES.ADMIN]: [
    "dashboard:read",
    "leaves:read",
    "workflow:read",
    "workflow:write",
    "qr:read",
    "qr:write",
    "analytics:read",
  ],
  [ROLES.SUPER_ADMIN]: [
    "dashboard:read",
    "leaves:read",
    "leaves:write",
    "workflow:read",
    "workflow:write",
    "qr:read",
    "qr:write",
    "users:read",
    "users:write",
    "analytics:read",
    "settings:read",
    "settings:write",
  ],
};

export const ROLE_HOME_ROUTES: Record<Role, string> = {
  [ROLES.GUARD]: ROUTES.GUARD_SCANNER,
  [ROLES.STUDENT]: ROUTES.STUDENT_DASHBOARD,
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.POC]: ROUTES.POC_DASHBOARD,
  [ROLES.SUPER_ADMIN]: ROUTES.SUPER_ADMIN_DASHBOARD,
};

export function hasPermission(
  roles: Role[],
  permission: Permission
) {
  return roles.some(role =>
    ROLE_PERMISSIONS[role].includes(permission)
  );
}

export function getHomeRoute(role: Role) {
  return ROLE_HOME_ROUTES[role];
}
