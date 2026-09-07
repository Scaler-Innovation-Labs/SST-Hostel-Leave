"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useActiveRole } from "@/hooks/use-active-role";
import type { Role } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const LABEL_CLASSES =
  "min-w-0 flex-1 truncate font-mono text-micro uppercase tracking-wider text-muted";

/**
 * The role label in the sidebar footer. Single-role users see today's
 * static label; users with several consoles get a switcher that navigates
 * between them. Switching is navigation only — authorization everywhere
 * keeps using the full assigned role set.
 */
export function RoleSwitcher({ fallbackLabel }: { fallbackLabel: string }) {
  const { roles, activeRole, isLoading, switchRole } = useActiveRole();
  const [switching, setSwitching] = useState(false);

  if (isLoading || roles.length <= 1) {
    return <span className={LABEL_CLASSES}>{fallbackLabel}</span>;
  }

  const active = roles.find((entry) => entry.role === activeRole) ?? roles[0]!;

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
            "flex min-w-0 flex-1 items-center gap-1 rounded-md text-left",
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
