import { redirect } from "next/navigation";

import { getCurrentUserRole } from "@/lib/auth/auth";
import { ROLES } from "@/lib/auth/roles";

export default async function RedirectPage() {
  const role =
    await getCurrentUserRole();

  switch (role) {
    case ROLES.STUDENT:
      redirect("/student/dashboard");

    case ROLES.ADMIN:
      redirect("/admin/dashboard");

    case ROLES.POC:
      redirect("/poc/dashboard");

    case ROLES.SUPER_ADMIN:
      redirect("/super-admin/dashboard");

    default:
      redirect("/unauthorized");
  }
}