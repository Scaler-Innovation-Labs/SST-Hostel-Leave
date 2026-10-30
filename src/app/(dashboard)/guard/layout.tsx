import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type GuardLayoutProps = {
  children: React.ReactNode;
};

export default async function GuardLayout({ children }: GuardLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.roles.some((r) => r === ROLES.GUARD || r === ROLES.SUPER_ADMIN)) {
    redirect("/unauthorized");
  }

  return (
    <AppShell
      nav="guard"
      logoHref={ROUTES.GUARD_SCANNER}
      roleLabel="Guard"
      density="guard"
    >
      {children}
    </AppShell>
  );
}
