import { redirect } from "next/navigation";

import { StaffDashboard } from "@/features/dashboard/components/StaffDashboard";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.roles.some((r) => r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN)) {
    redirect("/unauthorized");
  }

  return (
    <StaffDashboard
      basePath="/admin"
      title="Admin Dashboard"
      description="Manage leave approvals and movement workflows."
    />
  );
}
