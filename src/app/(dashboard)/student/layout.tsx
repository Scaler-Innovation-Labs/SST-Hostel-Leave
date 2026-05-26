import { AppShell } from "@/components/layout/AppShell";
import { navigation } from "@/constants/navigation";
import { requireRole } from "@/lib/auth/guards";
import { ROLES } from "@/lib/auth/roles";

type StudentLayoutProps = {
  children: React.ReactNode;
};

export default async function StudentLayout({
  children,
}: StudentLayoutProps) {
  await requireRole([
    ROLES.STUDENT,
  ]);

  const shellItems =
    navigation.student.map(
      ({ label, href }) => ({
        label,
        href,
      })
    );

  return (
    <AppShell
      items={shellItems}
    >
      {children}
    </AppShell>
  );
}