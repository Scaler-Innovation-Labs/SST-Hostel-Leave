"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { STUDENT_BOTTOM_NAV } from "@/constants/navigation";
import { cn } from "@/lib/utils";

/**
 * The student's mobile navigation. Thumb-reachable, every destination visible,
 * never a hamburger — a student between classes should not have to open a menu
 * to find out where they are.
 *
 * The rail is the same 2px accent edge used everywhere else, so "blue line =
 * you are here" is learned once and holds across the product.
 */
export function StudentBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Student navigation"
      className={cn(
        "sticky bottom-0 z-30 flex shrink-0 border-t border-border bg-surface md:hidden",
        // Clears the home indicator on iOS without a fixed magic number.
        "pb-[env(safe-area-inset-bottom)]"
      )}
    >
      {STUDENT_BOTTOM_NAV.map(({ label, href, Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex min-h-tap flex-1 flex-col items-center justify-center gap-1 px-2 py-2",
              "text-micro font-medium transition-colors duration-fast ease-standard",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
              active ? "text-accent" : "text-muted hover:text-ink"
            )}
          >
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
              />
            )}
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
