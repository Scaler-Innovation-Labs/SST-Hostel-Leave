import { AppShell } from "@/components/layout/AppShell";
import { navigation } from "@/constants/navigation";

type AdminLayoutProps = {
  children: React.ReactNode;
};

export default function AdminLayout({
  children,
}: AdminLayoutProps) {
  const shellItems =
    navigation.admin.map(
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