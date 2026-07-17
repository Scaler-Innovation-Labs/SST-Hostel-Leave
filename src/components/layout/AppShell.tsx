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
    <div className="relative min-h-screen bg-background">
      {/* Subtle gradient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-primary)/0.03,transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,var(--color-primary)/0.05,transparent_50%)]" />

      <DashboardNavbar items={items} logoHref={logoHref} />

      <main className="relative flex-1">
        <div className="p-3 sm:p-4 lg:p-6">
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>
    </div>
  );
}
