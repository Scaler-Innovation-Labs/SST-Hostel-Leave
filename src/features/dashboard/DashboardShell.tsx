import { Navbar } from "@/components/layout/Navbar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Logo } from "@/components/shared/Logo";

import { NavigationItem } from "@/constants/navigation";

type DashboardShellProps = {
  children: React.ReactNode;
  items: NavigationItem[];
};

export function DashboardShell({
  children,
  items,
}: DashboardShellProps) {
  const navItems = items.map(({ href, label }) => ({
    href,
    label,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        items={navItems}
        logo={<Logo />}
      />

      <div className="flex">
        <Sidebar items={items} />

        <main className="flex-1">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}