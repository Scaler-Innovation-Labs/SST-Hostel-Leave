"use client";

import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  icon: React.ElementType;
  /** Mono counter beside the title — "3 passes", "12 events". */
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  action?: React.ReactNode;
};

/**
 * A section card whose body can be folded away. Same geometry as
 * `SectionCard`, so a collapsible section and a static one sit together
 * without a seam.
 */
export function CollapsibleSection({
  title,
  icon: Icon,
  meta,
  defaultOpen = true,
  children,
  action,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  if (!children) return null;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            "flex min-w-0 items-center gap-2 rounded-sm text-left",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          )}
        >
          <Icon className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          <h2 className="text-small font-semibold text-ink">{title}</h2>
          {meta && (
            <span className="font-mono text-micro uppercase tracking-wider text-muted">
              {meta}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted transition-transform duration-fast ease-standard",
              open && "rotate-180"
            )}
            aria-hidden
          />
        </button>
        {action}
      </div>

      <div id={panelId} hidden={!open} className="mt-4">
        {children}
      </div>
    </section>
  );
}
