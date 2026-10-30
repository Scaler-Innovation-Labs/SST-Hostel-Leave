"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { STUDENT_BOTTOM_NAV } from "@/constants/navigation";
import { openMailto } from "@/lib/mailto";
import { cn } from "@/lib/utils";
import { resolveActiveHref } from "@/utils/navigation";

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

  // Only the most specific destination is marked current, so a nested page such
  // as `/student/leaves/new` does not also light up its parent "My leaves".
  const activeHref = resolveActiveHref(
    pathname,
    STUDENT_BOTTOM_NAV.map((item) => item.href)
  );

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
        const active = activeHref === href;
        const isExternal =
          href.startsWith("mailto:") ||
          href.startsWith("http://") ||
          href.startsWith("https://");

        const className = cn(
          "relative flex min-h-tap flex-1 flex-col items-center justify-center gap-1 px-2 py-2",
          "text-micro font-medium transition-colors duration-fast ease-standard",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent",
          active ? "text-accent" : "text-muted hover:text-ink"
        );

        const inner = (
          <>
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-accent"
              />
            )}
            <Icon className="h-5 w-5 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </>
        );

        if (isExternal) {
          return (
            <a
              key={href}
              href={href}
              onClick={(e) => {
                if (href.startsWith("mailto:")) {
                  e.preventDefault();
                  openMailto(href);
                }
              }}
              className={className}
              rel="noopener noreferrer"
            >
              {inner}
            </a>
          );
        }

        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
