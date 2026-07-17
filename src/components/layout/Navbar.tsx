"use client";

import { SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";
import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

import { ProfileMenu } from "./ProfileMenu";
import { ThemeToggle } from "./ThemeToggle";

type NavbarItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type NavbarProps = {
  items: NavbarItem[];
  logo?: React.ReactNode;
};

export function Navbar({ items, logo }: NavbarProps) {
  const pathname = usePathname();
  const { user } = useUser();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    // Exact match or child route — avoids false positives like /leaves matching /leaves/new
    return pathname === href || pathname.startsWith(href + "/");
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-xl transition-shadow duration-300",
        scrolled ? "shadow-md" : "shadow-sm",
      )}
    >
      {/* Subtle gradient accent line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-primary/30 to-transparent" />

      <div className="flex h-16 items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6">
        {/* LEFT: Logo */}
        <div className="flex shrink-0 items-center">{logo}</div>

        {/* CENTER: Desktop nav */}
        <nav className="hidden items-center justify-center gap-0.5 md:flex">
          {items.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative inline-flex items-center gap-1.5 rounded-xl px-2.5 lg:px-3 py-2 text-sm font-medium transition-all duration-200",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {Icon && <Icon className="h-4 w-4 shrink-0" />}
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden">{item.label.length > 8 ? item.label.slice(0, 7) + "…" : item.label}</span>
                {active && (
                  <span className="absolute -bottom-[9px] left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT: Actions */}
        <div className="flex items-center gap-1">
          <ThemeToggle />

          {/* Desktop auth */}
          <div className="hidden items-center gap-1 md:flex">
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

          {/* Mobile menu trigger */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button
                className="inline-flex items-center justify-center rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:hidden"
                aria-label="Toggle menu"
              >
                <Menu className="size-5" />
              </button>
            </SheetTrigger>

            <SheetContent side="right" className="flex w-72 flex-col p-0 max-sm:w-full">
              {/* Gradient header accent */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-linear-to-r from-transparent via-primary/30 to-transparent" />

              {/* Mobile header */}
              <div className="flex items-center justify-between border-b border-border px-5 py-4">
                {logo}
              </div>

              {/* Mobile nav links */}
              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="space-y-1">
                  {items.map((item) => {
                    const active = isActive(item.href);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobile}
                        className={cn(
                          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-primary/10 text-primary"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            Icon ? (active ? "bg-primary/15" : "bg-muted") : "bg-transparent",
                          )}
                        >
                          {Icon ? <Icon className="h-4 w-4" /> : null}
                        </div>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </nav>

              {/* Mobile auth footer */}
              <div className="border-t border-border px-5 py-4">
                <SignedOut>
                  <Link
                    href={ROUTES.LOGIN}
                    onClick={closeMobile}
                    className="flex w-full items-center justify-center rounded-xl bg-linear-to-r from-blue-500 to-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm"
                  >
                    Login
                  </Link>
                </SignedOut>

                <SignedIn>
                  <div className="flex items-center gap-3">
                    <UserButton afterSignOutUrl="/" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {user?.fullName ?? "User"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user?.primaryEmailAddress?.emailAddress ?? ""}
                      </p>
                    </div>
                  </div>
                </SignedIn>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}