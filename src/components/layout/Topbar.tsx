"use client";

import { SignedIn } from "@clerk/nextjs";
import { Menu, Search } from "lucide-react";

import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { cn } from "@/lib/utils";

type TopbarProps = {
  /** Opens the off-canvas sidebar below lg. */
  onOpenNav: () => void;
  onOpenSearch: () => void;
  /** Where the drawer trigger reads from, for the screen reader. */
  roleLabel: string;
};

/**
 * Navigation lives in the sidebar, so the bar carries only what is not a
 * destination: search, theme, and who you are. Below lg it also carries the
 * drawer trigger.
 */
export function Topbar({ onOpenNav, onOpenSearch, roleLabel }: TopbarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 px-3 sm:px-4",
        // Translucent over blur so content scrolling under stays faintly
        // visible; opaque fallback where backdrop-filter is unsupported.
        "border-b border-border/70 bg-surface supports-[backdrop-filter]:bg-surface/70",
        "supports-[backdrop-filter]:backdrop-blur-xl"
      )}
    >
      <button
        type="button"
        onClick={onOpenNav}
        aria-label={`Open ${roleLabel} navigation`}
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted lg:hidden",
          "transition-colors duration-fast ease-standard hover:bg-surface-hover hover:text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      {/*
        The search affordance is visible, not just a shortcut — a command
        palette nobody knows about is a palette nobody uses.
      */}
      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Search (Command K)"
        className={cn(
          "flex w-full max-w-sm items-center gap-2.5 rounded-lg px-3 py-2",
          "border border-border bg-surface-sunken text-caption text-muted",
          "transition-all duration-fast ease-standard",
          "hover:border-border-strong/50 hover:bg-surface-hover hover:text-ink",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">Search</span>
        <kbd className="ml-auto hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-micro leading-none text-muted sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <SignedIn>
          <ThemeToggle />
          <ProfileMenu />
        </SignedIn>
      </div>
    </header>
  );
}
