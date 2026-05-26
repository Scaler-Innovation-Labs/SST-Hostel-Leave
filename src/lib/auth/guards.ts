import { redirect } from "next/navigation";

import { getCurrentUserRole } from "./auth";

import { Role } from "./roles";

export async function requireRole(
  allowedRoles: Role[]
) {
  const role =
    await getCurrentUserRole();

  if (!allowedRoles.includes(role)) {
    redirect("/unauthorized");
  }

  return role;
}