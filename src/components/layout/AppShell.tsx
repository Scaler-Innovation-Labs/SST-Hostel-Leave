"use client";

import { SignedIn } from "@clerk/nextjs";
import * as React from "react";

import { AppSidebar } from "@/components/layout/AppSidebar";
import { CommandPalette } from "@/components/layout/CommandPalette";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { StudentBottomNav } from "@/components/layout/StudentBottomNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { Topbar } from "@/components/layout/Topbar";
import {
  NAVIGATION,
  type NavigationConsole,
} from "@/constants/navigation";
import { type Density,DensityProvider } from "@/design-system/sst";
import { useSidebarCollapsed } from "@/hooks/use-sidebar-collapsed";
import { cn } from "@/lib/utils";

type AppShellProps = {
  /**
   * The console whose navigation to show. A key rather than the groups
   * themselves — the nav items carry icon components, and functions cannot be
   * passed from a server component to a client one.
   */
  nav: NavigationConsole;
  logoHref: string;
  roleLabel: string;
  density: Density;
  /** Keyed by href — a live count rides at the end of its own nav row. */
  badges?: Record<string, React.ReactNode>;
  /** Students get a thumb-reachable bottom bar below md instead of a drawer. */
  bottomNav?: boolean;
  children: React.ReactNode;
};

/**
 * A fixed navigation column on the left, a slim bar and the content column on
 * the right.
 *
 * This replaced a horizontal navbar that could not hold the super-admin's
 * seventeen destinations — they rendered as one scrolling strip with most of
 * them off-screen. A vertical column has the room to show them all, grouped.
 */
export function AppShell({
  nav,
  logoHref,
  roleLabel,
  density,
  badges,
  bottomNav = false,
  children,
}: AppShellProps) {
  const groups = NAVIGATION[nav];
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // The drawer is a layer over the page; letting the page behind it scroll is
  // how a phone loses its place.
  React.useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  return (
    <DensityProvider density={density}>
      <div className="min-h-screen bg-bg">
        <AppSidebar
          groups={groups}
          logoHref={logoHref}
          roleLabel={roleLabel}
          badges={badges}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          mobileOpen={mobileOpen}
          onNavigate={() => setMobileOpen(false)}
        />

        {mobileOpen && (
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
        )}

        {/*
          Both padding classes are written out literally so Tailwind's scanner
          emits them — a computed class string compiles to nothing.
        */}
        <div
          className={cn(
            "flex min-h-screen flex-col transition-[padding] duration-base ease-standard",
            collapsed ? "lg:pl-[60px]" : "lg:pl-[236px]"
          )}
        >
          <Topbar
            onOpenNav={() => setMobileOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            roleLabel={roleLabel}
          />

          <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>

          {bottomNav && <StudentBottomNav />}
        </div>

        <CommandPalette
          open={searchOpen}
          onOpenChange={setSearchOpen}
          groups={groups}
        />
      </div>
    </DensityProvider>
  );
}

/**
 * The field shell. One screen, one task: no sidebar, no tabs, no nested
 * navigation, single column at every width, 64px targets throughout.
 */
export function FieldShell({
  children,
  roleLabel,
}: {
  children: React.ReactNode;
  roleLabel: string;
}) {
  return (
    <DensityProvider density="guard">
      <div className="flex min-h-screen flex-col bg-bg">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
          <span className="font-mono text-micro uppercase tracking-wider text-muted">
            {roleLabel}
          </span>
          {/* Deliberately thin: nothing here competes with the scanner. */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <SignedIn>
              <ThemeToggle />
              <ProfileMenu />
            </SignedIn>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </DensityProvider>
  );
}
