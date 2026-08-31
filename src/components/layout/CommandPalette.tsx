"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import * as React from "react";

import type { NavigationGroup } from "@/constants/navigation";
import { cn } from "@/lib/utils";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groups: NavigationGroup[];
};

type Entry = {
  label: string;
  href: string;
  heading: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

/**
 * Jump to any destination in the current console.
 *
 * The palette is deliberately small: it searches the same grouped navigation
 * the sidebar renders, so there is one list of destinations in the product and
 * no second index to drift out of sync.
 */
export function CommandPalette({
  open,
  onOpenChange,
  groups,
}: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [highlighted, setHighlighted] = React.useState(0);

  const entries = React.useMemo<Entry[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          label: item.label,
          href: item.href,
          heading: group.heading,
          Icon: item.Icon,
        }))
      ),
    [groups]
  );

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (entry) =>
        entry.label.toLowerCase().includes(q) ||
        entry.heading.toLowerCase().includes(q)
    );
  }, [entries, query]);

  /**
   * Query and highlight move together. Resetting the highlight in an effect
   * keyed on the query would let one render land with a stale index, and Enter
   * in that window goes to the wrong row.
   */
  function onQueryChange(next: string) {
    setQuery(next);
    setHighlighted(0);
  }

  function onDialogOpenChange(next: boolean) {
    if (!next) {
      setQuery("");
      setHighlighted(0);
    }
    onOpenChange(next);
  }

  const go = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router]
  );

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[highlighted];
      if (target) go(target.href);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onDialogOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-scaler-depth/70 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          onKeyDown={onKeyDown}
          className={cn(
            "fixed left-1/2 top-24 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2",
            "overflow-hidden rounded-2xl border border-border bg-surface shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-base",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast"
          )}
        >
          <DialogPrimitive.Title className="sr-only">
            Search destinations
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Type to filter, arrow keys to move, Enter to go.
          </DialogPrimitive.Description>

          <div className="flex items-center gap-2.5 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Go to…"
              aria-label="Search destinations"
              className="h-12 w-full bg-transparent text-body text-ink placeholder:text-muted focus:outline-none"
            />
            <kbd className="hidden shrink-0 rounded border border-border bg-surface-sunken px-1.5 py-0.5 font-mono text-micro leading-none text-muted sm:block">
              esc
            </kbd>
          </div>

          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-caption text-muted">
              Nothing here matches “{query}”. Try a shorter word.
            </p>
          ) : (
            <ul className="max-h-80 overflow-y-auto p-2">
              {results.map((entry, index) => (
                <li key={entry.href}>
                  <button
                    type="button"
                    onClick={() => go(entry.href)}
                    onMouseEnter={() => setHighlighted(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-small",
                      "transition-colors duration-fast ease-standard",
                      index === highlighted
                        ? "bg-accent-light text-accent"
                        : "text-ink hover:bg-surface-hover"
                    )}
                  >
                    <entry.Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 truncate font-medium">
                      {entry.label}
                    </span>
                    <span className="shrink-0 font-mono text-micro uppercase tracking-wider text-muted">
                      {entry.heading}
                    </span>
                    {index === highlighted && (
                      <CornerDownLeft
                        className="h-3 w-3 shrink-0 text-accent"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
