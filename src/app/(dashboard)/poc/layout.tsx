import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type PocLayoutProps = {
  children: React.ReactNode;
};

export default async function PocLayout({ children }: PocLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.some((r) => r === ROLES.POC)) {
    redirect("/unauthorized");
  }

  return (
    <AppShell
      nav="poc"
      logoHref={ROUTES.POC_DASHBOARD}
      roleLabel="POC"
      density="admin"
    >
      {children}
    </AppShell>
  );
}
