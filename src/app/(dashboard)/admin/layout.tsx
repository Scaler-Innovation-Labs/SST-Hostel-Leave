import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
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

  if (!user.roles.includes(ROLES.ADMIN)) {
    redirect("/unauthorized");
  }

  const shellItems =
    NAVIGATION.admin.map(
      ({ label, href }) => ({
        label,
        href,
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
