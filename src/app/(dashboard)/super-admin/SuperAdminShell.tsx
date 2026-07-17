"use client";

import { SignedIn, SignedOut } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { MobileSidebar,SuperAdminSidebar } from "@/components/layout/SuperAdminSidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { PageTransition } from "@/components/shared/PageTransition";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";

type SuperAdminShellProps = {
  children: React.ReactNode;
};

export function SuperAdminShell({ children }: SuperAdminShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Subtle gradient background */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,var(--color-primary)/0.03,transparent_50%)] dark:bg-[radial-gradient(ellipse_at_top_left,var(--color-primary)/0.05,transparent_50%)]" />

      <SuperAdminSidebar />

      {/* Main area */}
      <div className="relative flex flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/95 px-3 backdrop-blur-xl sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile hamburger */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                  aria-label="Toggle menu"
                >
                  <Menu className="size-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-64 max-sm:w-full flex-col p-0">
                {/* Gradient accent */}
                <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-primary/30 to-transparent" />
                <MobileSidebar onNavigate={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>

            <span className="text-sm font-medium text-muted-foreground max-md:hidden">
              Super Admin
            </span>
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            <SignedOut>
              <Link
                href={ROUTES.LOGIN}
                className="inline-flex items-center justify-center rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110"
              >
                Login
              </Link>
            </SignedOut>

            <SignedIn>
              <NotificationBell />
              <ProfileMenu />
            </SignedIn>
          </div>
        </header>

        {/* Content */}
        <main className="relative flex-1">
          <div className="p-3 sm:p-4 lg:p-6">
            <PageTransition>{children}</PageTransition>
          </div>
        </main>
      </div>
    </div>
  );
}
