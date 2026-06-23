import type { ReactNode } from "react";

import { PageTransition } from "@/components/shared/PageTransition";

import { DashboardNavbar } from "./DashboardNavbar";

type ShellNavItem = {
  label: string;
  href: string;
};

type AppShellProps = {
  children: ReactNode;
  items: ShellNavItem[];
  logoHref?: string;
};

export function AppShell({
  children,
  items,
  logoHref,
}: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <DashboardNavbar items={items} logoHref={logoHref} />

      <main className="flex-1">
        <div className="p-4 sm:p-6">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
