"use client";

import { useMemo } from "react";

import type { Permission } from "@/lib/auth/permissions";
import { hasPermission as checkPermission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

import { useCurrentUser } from "./use-current-user";

export function usePermissions() {
  const { roles } = useCurrentUser();

  return useMemo(() => {
    const roleSet = roles as Role[];

    return {
      can: (permission: Permission) => checkPermission(roleSet, permission),
      roles: roleSet,
      hasRole: (role: Role) => roleSet.includes(role),
      hasAnyRole: (checkRoles: Role[]) => checkRoles.some((r) => roleSet.includes(r)),
    };
  }, [roles]);
}
