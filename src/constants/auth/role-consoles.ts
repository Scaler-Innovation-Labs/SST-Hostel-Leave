import { type Role,ROLES } from "@/lib/auth/roles";

import { ROUTES } from "../routes";

export type RoleConsole = {
  role: Role;
  label: string;
  dashboardHref: string;
};

/**
 * Every role that owns a console. The role switcher only ever navigates
 * within this map — switching consoles never grants anything, because all
 * authorization checks keep using the user's full assigned role set.
 */
export const ROLE_CONSOLES: Record<Role, RoleConsole> = {
  [ROLES.STUDENT]: {
    role: ROLES.STUDENT,
    label: "Student",
    dashboardHref: ROUTES.STUDENT_DASHBOARD,
  },
  [ROLES.POC]: {
    role: ROLES.POC,
    label: "POC",
    dashboardHref: ROUTES.POC_DASHBOARD,
  },
  [ROLES.ADMIN]: {
    role: ROLES.ADMIN,
    label: "Admin",
    dashboardHref: ROUTES.ADMIN_DASHBOARD,
  },
  [ROLES.SUPER_ADMIN]: {
    role: ROLES.SUPER_ADMIN,
    label: "Super admin",
    dashboardHref: ROUTES.SUPER_ADMIN_DASHBOARD,
  },
  [ROLES.GUARD]: {
    role: ROLES.GUARD,
    label: "Gate",
    dashboardHref: ROUTES.GUARD_SCANNER,
  },
};

/**
 * Signed-out-proof session preference, not a permission: the value is
 * re-validated against the user's assigned DB roles on every read, and an
 * unknown or unassigned value falls back to the default console.
 */
export const ACTIVE_ROLE_COOKIE = "sst_active_role";
