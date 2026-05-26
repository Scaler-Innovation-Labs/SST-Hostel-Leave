import { DashboardShell } from "@/features/dashboard/DashboardShell";

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

  return (
    <DashboardShell
      items={navigation.student}
    >
      {children}
    </DashboardShell>
  );
}