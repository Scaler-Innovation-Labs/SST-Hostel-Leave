import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";
import { ExtensionApprovalCountBadge } from "@/features/extensions/components/ExtensionApprovalCountBadge";
import { OverdueCountBadge } from "@/features/students/components/OverdueCountBadge";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type SuperAdminLayoutProps = {
  children: React.ReactNode;
};

export default async function SuperAdminLayout({
  children,
}: SuperAdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.includes(ROLES.SUPER_ADMIN)) {
    redirect("/unauthorized");
  }

  const badges = {
    [ROUTES.SUPER_ADMIN_APPROVALS]: <ApprovalCountBadge />,
    [ROUTES.SUPER_ADMIN_EXTENSION_APPROVALS]: <ExtensionApprovalCountBadge />,
    [ROUTES.SUPER_ADMIN_OVERDUE]: <OverdueCountBadge />,
  };

  return (
    <AppShell
      nav="superAdmin"
      logoHref={ROUTES.SUPER_ADMIN_DASHBOARD}
      roleLabel="Super admin"
      density="admin"
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
