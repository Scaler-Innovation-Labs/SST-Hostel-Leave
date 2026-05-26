import type { ReactNode } from "react";

import { DashboardNavbar } from "./DashboardNavbar";
import { DashboardSidebar } from "./DashboardSidebar";

type ShellNavItem = {
  label: string;
  href: string;
};

type AppShellProps = {
  children: ReactNode;
  items: ShellNavItem[];
};

export function AppShell({
  children,
  items,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar items={items} />

      <div className="flex">
        <DashboardSidebar items={items} />

        <main className="flex-1">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
