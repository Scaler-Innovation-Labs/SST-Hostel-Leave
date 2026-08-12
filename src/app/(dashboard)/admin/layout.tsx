import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { ApprovalCountBadge } from "@/features/approvals/components/ApprovalCountBadge";
import { ExtensionApprovalCountBadge } from "@/features/extensions/components/ExtensionApprovalCountBadge";
import { OverdueCountBadge } from "@/features/students/components/OverdueCountBadge";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default async function AdminLayout({
  children,
}: AdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.some((r) => r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN)) {
    redirect("/unauthorized");
  }

  const shellItems =
    NAVIGATION.admin.map(
      ({ label, href }) => ({
        label,
        href,
        badge:
          href === ROUTES.ADMIN_APPROVALS
            ? <ApprovalCountBadge />
            : href === ROUTES.ADMIN_EXTENSION_APPROVALS
              ? <ExtensionApprovalCountBadge />
              : href === ROUTES.ADMIN_OVERDUE
                ? <OverdueCountBadge />
                : undefined,
      })
    );

  return (
    <AppShell
      items={shellItems}
      logoHref={ROUTES.ADMIN_DASHBOARD}
    >
      {children}
    </AppShell>
  );
}
