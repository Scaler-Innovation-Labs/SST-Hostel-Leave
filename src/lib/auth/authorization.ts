import { AuthorizationError } from "@/lib/errors";

import type { Role } from "./roles";
import { canRoleApprove } from "./roles";
import type { CurrentUser } from "./types";

export function hasRole(
  user: CurrentUser,
  role: Role
): boolean {
  return user.roles.includes(role);
}

export function hasAnyRole(
  user: CurrentUser,
  roles: Role[]
): boolean {
  return roles.some(role =>
    user.roles.includes(role)
  );
}

export function requireRole(
  user: CurrentUser,
  role: Role
): CurrentUser {
  if (!hasRole(user, role)) {
    throw new AuthorizationError();
  }

  return user;
}

export function requireAnyRole(
  user: CurrentUser,
  roles: Role[]
): CurrentUser {
  if (!hasAnyRole(user, roles)) {
    throw new AuthorizationError();
  }

  return user;
}

export function canApproveApproval(
  approval: { approverUserId: string | null; approverRoleCode: string | null },
  currentUser: { id: string; roles: string[] }
): boolean {
  if (approval.approverUserId && approval.approverUserId !== currentUser.id) {
    return false;
  }

  if (approval.approverRoleCode && !canRoleApprove(currentUser.roles as Role[], approval.approverRoleCode)) {
    return false;
  }

  return true;
}

export function requireApprovalAuthorization(
  approval: { approverUserId: string | null; approverRoleCode: string | null },
  currentUser: { id: string; roles: string[] }
): void {
  if (!canApproveApproval(approval, currentUser)) {
    throw new AuthorizationError();
  }
}