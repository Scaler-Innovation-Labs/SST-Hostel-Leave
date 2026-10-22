"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveRole } from "@/hooks/use-active-role";
import { type Role, ROLES } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const LABEL_CLASSES =
  "min-w-0 flex-1 truncate font-mono text-micro uppercase tracking-wider text-muted";

const LABEL_TO_ROLE: Record<string, Role> = {
  admin: ROLES.ADMIN,
  guard: ROLES.GUARD,
  gate: ROLES.GUARD,
  poc: ROLES.POC,
  student: ROLES.STUDENT,
  "super admin": ROLES.SUPER_ADMIN,
  super_admin: ROLES.SUPER_ADMIN,
};

function getRoleFromPathname(pathname: string | null): Role | null {
  if (!pathname) return null;
  if (pathname.startsWith("/guard")) return ROLES.GUARD;
  if (pathname.startsWith("/super-admin")) return ROLES.SUPER_ADMIN;
  if (pathname.startsWith("/admin")) return ROLES.ADMIN;
  if (pathname.startsWith("/student")) return ROLES.STUDENT;
  if (pathname.startsWith("/poc")) return ROLES.POC;
  return null;
}

/**
 * The role label in the sidebar footer. Single-role users see today's
 * static label; users with several consoles get a switcher that navigates
 * between them. Switching is navigation only — authorization everywhere
 * keeps using the full assigned role set.
 *
 * `compact` renders a header-sized trigger for shells without a sidebar
 * (e.g. the guard field shell) instead of the full-width footer trigger.
 */
export function RoleSwitcher({
  fallbackLabel,
  currentRole: explicitRole,
  compact = false,
}: {
  fallbackLabel: string;
  currentRole?: Role;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const { roles: rawRoles, activeRole, isLoading, switchRole } = useActiveRole();
  const [switching, setSwitching] = useState(false);

  // Deduplicate roles by role code to guarantee no console is listed repeatedly
  const roles = useMemo(() => {
    const seen = new Set<string>();
    return rawRoles.filter((entry) => {
      if (!entry?.role || seen.has(entry.role)) return false;
      seen.add(entry.role);
      return true;
    });
  }, [rawRoles]);

  if (isLoading || roles.length <= 1) {
    return <span className={LABEL_CLASSES}>{fallbackLabel}</span>;
  }

  // Derive current console:
  // 1. Explicit currentRole prop if provided
  // 2. Role matching the current route URL
  // 3. Role matching the fallbackLabel passed from layout
  // 4. Stored activeRole from cookie / session
  // 5. First assigned role
  const resolvedCurrentRole =
    explicitRole ??
    getRoleFromPathname(pathname) ??
    LABEL_TO_ROLE[fallbackLabel.toLowerCase().trim()] ??
    activeRole;

  const active =
    roles.find((entry) => entry.role === resolvedCurrentRole) ??
    roles.find((entry) => entry.role === activeRole) ??
    roles[0]!;

  const handleSelect = async (role: Role) => {
    if (role === active.role || switching) return;
    setSwitching(true);
    try {
      await switchRole(role);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not switch role");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={switching}
          aria-label={`Switch console, current: ${active.label}`}
          className={cn(
            "items-center gap-1 rounded-md text-left",
            compact
              ? "inline-flex max-w-44 shrink-0 px-2 py-1"
              : "flex min-w-0 flex-1",
            "transition-colors duration-fast ease-standard hover:bg-surface-hover",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            "disabled:opacity-60"
          )}
        >
          <span className={LABEL_CLASSES}>{active.label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted" aria-hidden />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Switch console</DropdownMenuLabel>
        {roles.map((entry) => (
          <DropdownMenuItem
            key={entry.role}
            onClick={() => handleSelect(entry.role)}
            className="cursor-pointer"
          >
            <Check
              className={cn(
                "mr-2 h-4 w-4 shrink-0",
                entry.role === active.role ? "text-accent" : "text-transparent"
              )}
              aria-hidden
            />
            {entry.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
