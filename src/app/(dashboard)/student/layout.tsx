import { DashboardShell } from "@/features/dashboard/DashboardShell";

import { navigation } from "@/constants/navigation";

type StudentLayoutProps = {
  children: React.ReactNode;
};

export default function StudentLayout({
  children,
}: StudentLayoutProps) {
  return (
    <DashboardShell
      items={navigation.student}
    >
      {children}
    </DashboardShell>
  );
}