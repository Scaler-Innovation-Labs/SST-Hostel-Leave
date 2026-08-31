"use client";

import { PanelLeft } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Logo } from "@/components/shared/Logo";
import type { NavigationGroup } from "@/constants/navigation";
import { cn } from "@/lib/utils";

type AppSidebarProps = {
  groups: NavigationGroup[];
  logoHref: string;
  /** Shown in the foot in the mono label — which console you are in. */
  roleLabel: string;
  /** Keyed by href, so a live count rides at the end of its own row. */
  badges?: Record<string, React.ReactNode>;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** Below lg the sidebar is an off-canvas drawer. */
  mobileOpen: boolean;
  onNavigate: () => void;
};

/**
 * Matches the current route to a nav row. A parent route matches its children
 * (`/student/leaves` for `/student/leaves/123`) unless a sibling item is an
 * exact match for the path — otherwise "Request leave" and "My leaves" would
 * both light up on `/student/leaves/new`.
 */
function useActiveHref(groups: NavigationGroup[]): (href: string) => boolean {
  const pathname = usePathname();
  const allHrefs = React.useMemo(
    () => groups.flatMap((group) => group.items.map((item) => item.href)),
    [groups]
  );

  return React.useCallback(
    (href: string) => {
      if (pathname === href) return true;
      if (!pathname.startsWith(`${href}/`)) return false;
      return !allHrefs.some((other) => other !== href && other === pathname);
    },
    [pathname, allHrefs]
  );
}

function NavRow({
  href,
  label,
  Icon,
  badge,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: React.ReactNode;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={cn(
        "group relative flex items-center rounded-md text-small font-medium",
        "transition-all duration-fast ease-standard",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        "focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-2.5 py-2",
        active
          ? "bg-accent-light text-accent ring-1 ring-inset ring-accent/15"
          : "text-muted hover:bg-surface-hover hover:text-ink"
      )}
    >
      {/* The active marker — the only place the accent appears in this column. */}
      {active && (
        <span
          aria-hidden
          className="absolute -left-2 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-accent"
        />
      )}

      <Icon className="h-4 w-4 shrink-0" aria-hidden />

      {!collapsed && <span className="min-w-0 flex-1 truncate">{label}</span>}

      {badge && (
        <span className={cn("shrink-0", collapsed && "absolute right-1 top-1")}>
          {badge}
        </span>
      )}
    </Link>
  );
}

export function AppSidebar({
  groups,
  logoHref,
  roleLabel,
  badges,
  collapsed,
  onCollapsedChange,
  mobileOpen,
  onNavigate,
}: AppSidebarProps) {
  const isActive = useActiveHref(groups);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-border bg-surface",
        "transition-transform duration-base ease-standard lg:transition-[width]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        collapsed ? "w-[236px] lg:w-[60px]" : "w-[236px]"
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "px-4"
        )}
      >
        {collapsed ? (
          <Link
            href={logoHref}
            aria-label="SST Hostel Leave Platform"
            className="flex h-8 w-8 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <span className="font-mono text-micro font-semibold uppercase tracking-wider text-accent">
              SST
            </span>
          </Link>
        ) : (
          <Logo href={logoHref} />
        )}
      </div>

      <nav
        aria-label={`${roleLabel} navigation`}
        className="no-scrollbar flex-1 overflow-y-auto px-3 py-3"
      >
        {groups.map((group) => (
          <div key={group.heading} className="mb-1">
            {collapsed ? (
              // A hairline stands in for the heading so the grouping survives
              // without room for words.
              <div aria-hidden className="mx-3 mb-2 border-t border-border" />
            ) : (
              <p className="px-3 pb-2 pt-1 font-mono text-micro uppercase tracking-wider text-muted/70">
                {group.heading}
              </p>
            )}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavRow
                    href={item.href}
                    label={item.label}
                    Icon={item.Icon}
                    badge={badges?.[item.href]}
                    active={isActive(item.href)}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-t border-border px-3 py-3",
          collapsed && "justify-center px-2"
        )}
      >
        {!collapsed && (
          <span className="min-w-0 flex-1 truncate font-mono text-micro uppercase tracking-wider text-muted">
            {roleLabel}
          </span>
        )}
        <button
          type="button"
          onClick={() => onCollapsedChange(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "hidden h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted lg:inline-flex",
            "transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-ink",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          )}
        >
          <PanelLeft
            className={cn(
              "h-4 w-4 transition-transform duration-base ease-standard",
              collapsed && "rotate-180"
            )}
            aria-hidden
          />
        </button>
      </div>
    </aside>
  );
}
