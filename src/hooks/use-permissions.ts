"use client";

import { useMemo } from "react";

import type { Permission } from "@/lib/auth/permissions";
import { hasPermission as checkPermission } from "@/lib/auth/permissions";
import type { Role } from "@/lib/auth/roles";

import { useActiveRole } from "./use-active-role";

/**
 * Client-side role checks. Roles come from the DB-backed roles endpoint —
 * not Clerk public metadata, which nothing in the app writes — so this
 * agrees with the server layouts.
 */
export function usePermissions() {
  const { roles, isLoading } = useActiveRole();

  return useMemo(() => {
    const roleSet = roles.map((entry) => entry.role) as Role[];

    return {
      can: (permission: Permission) => checkPermission(roleSet, permission),
      roles: roleSet,
      hasRole: (role: Role) => roleSet.includes(role),
      hasAnyRole: (checkRoles: Role[]) => checkRoles.some((r) => roleSet.includes(r)),
      isLoading,
    };
  }, [roles, isLoading]);
}
