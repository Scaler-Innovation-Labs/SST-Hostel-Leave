import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type GuardLayoutProps = {
  children: React.ReactNode;
};

export default async function GuardLayout({
  children,
}: GuardLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.includes(ROLES.GUARD)) {
    redirect("/unauthorized");
  }

  const shellItems =
    NAVIGATION.guard.map(
      ({ label, href }) => ({
        label,
        href,
      }),
    );

  return (
    <AppShell
      items={shellItems}
      logoHref={ROUTES.GUARD_SCANNER}
    >
      {children}
    </AppShell>
  );
}
