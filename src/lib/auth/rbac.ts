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
  [ROLES.STUDENT]: ROUTES.STUDENT_DASHBOARD,
  [ROLES.ADMIN]: ROUTES.ADMIN_DASHBOARD,
  [ROLES.POC]: ROUTES.POC_DASHBOARD,
  [ROLES.SUPER_ADMIN]: ROUTES.SUPER_ADMIN_DASHBOARD,
};

export function hasPermission(
  role: Role,
  permission: Permission
) {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function getHomeRoute(role: Role) {
  return ROLE_HOME_ROUTES[role];
}
