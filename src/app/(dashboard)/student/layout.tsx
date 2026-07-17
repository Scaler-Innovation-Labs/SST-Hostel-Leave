import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/AppShell";
import { NAVIGATION } from "@/constants/navigation";
import { ROUTES } from "@/constants/routes";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

type StudentLayoutProps = {
  children: React.ReactNode;
};

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/unauthorized");
  }

  if (!user.roles.includes(ROLES.STUDENT)) {
    redirect("/unauthorized");
  }

  const shellItems =
    NAVIGATION.student.map(
      ({ label, href }) => ({
        label,
        href,
      })
    );

  return (
    <AppShell
      items={shellItems}
      logoHref={ROUTES.STUDENT_DASHBOARD}
    >
      {children}
    </AppShell>
  );
}