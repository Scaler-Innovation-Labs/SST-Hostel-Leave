import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";
import { ExtensionApprovalCountBadge } from "@/features/extensions/components/ExtensionApprovalCountBadge";
import { OverdueCountBadge } from "@/features/students/components/OverdueCountBadge";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.some((r) => r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN)) {
    redirect("/unauthorized");
  }

  /** What is waiting on you, keyed by the row it rides on. */
  const badges = {
    [ROUTES.ADMIN_APPROVALS]: <ApprovalCountBadge />,
    [ROUTES.ADMIN_EXTENSION_APPROVALS]: <ExtensionApprovalCountBadge />,
    [ROUTES.ADMIN_OVERDUE]: <OverdueCountBadge />,
  };

  return (
    <AppShell
      nav="admin"
      logoHref={ROUTES.ADMIN_DASHBOARD}
      roleLabel="Admin"
      density="admin"
      badges={badges}
    >
      {children}
    </AppShell>
  );
}
