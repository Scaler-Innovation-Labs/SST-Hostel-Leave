import { isRole, type Role,ROLE_HIERARCHY } from "@/lib/auth/roles";
import { AuthorizationError } from "@/lib/errors";

/**
 * The console the user is currently viewing. This is a navigation
 * preference, never a permission: every authorization check in the app
 * keeps using the full assigned role set, so switching consoles cannot
 * escalate anything. Callers persist the result in the active-role cookie;
 * this module stays framework-free so it is unit-testable.
 */
export function resolveActiveRole(
  assignedRoles: Role[],
  requested: string | null | undefined
): Role | null {
  if (requested && isRole(requested) && assignedRoles.includes(requested)) {
    return requested;
  }

  let best: Role | null = null;
  for (const role of assignedRoles) {
    if (!best || ROLE_HIERARCHY[role] > ROLE_HIERARCHY[best]) {
      best = role;
    }
  }
  return best;
}

export function validateRoleSwitch(
  assignedRoles: Role[],
  target: Role
): Role {
  if (!assignedRoles.includes(target)) {
    throw new AuthorizationError();
  }
  return target;
}
