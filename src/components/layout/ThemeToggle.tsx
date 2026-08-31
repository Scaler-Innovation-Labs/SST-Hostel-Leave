"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

/**
 * An explicit choice, so it always beats the OS setting.
 *
 * Which icon shows is decided by the `dark` variant rather than by React
 * state: the server does not know the resolved theme, so a state-driven icon
 * would either render the wrong glyph on first paint or need a mount gate that
 * makes the control pop in a tick late.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Switch theme"
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted",
        "transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-ink",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      )}
    >
      <Sun className="hidden h-4 w-4 dark:block" aria-hidden />
      <Moon className="h-4 w-4 dark:hidden" aria-hidden />
    </button>
  );
}
