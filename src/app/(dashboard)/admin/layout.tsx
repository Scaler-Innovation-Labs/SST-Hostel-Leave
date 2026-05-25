import { DashboardShell } from "@/features/dashboard/DashboardShell";

import { navigation } from "@/constants/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  return (
    <DashboardShell
      items={navigation.admin}
    >
      {children}
    </DashboardShell>
  );
}