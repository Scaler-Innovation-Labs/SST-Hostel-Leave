import * as React from "react";

import { cn } from "@/lib/utils";

import { FOCUS } from "./interaction";

type FilterChipProps = {
  label: string;
  /** The number of records behind this filter. */
  count: number;
  Icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active?: boolean;
  onClick: () => void;
  className?: string;
};

/**
 * A count that is also a filter.
 *
 * Deliberately quiet: a filter is a control, not a metric, and a row of them
 * in six different tinted washes reads as six competing statuses. The ground
 * stays neutral and the accent appears only on the one that is actually on —
 * the same "blue means you are here" the nav uses.
 */
export function FilterChip({
  label,
  count,
  Icon,
  active = false,
  onClick,
  className,
}: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2",
        "text-small font-medium transition-colors duration-fast ease-standard",
        FOCUS,
        active
          ? "border-accent bg-accent-light text-accent ring-1 ring-inset ring-accent/20"
          : "border-border bg-surface text-muted hover:border-border-strong hover:bg-surface-hover hover:text-ink",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0" aria-hidden />}
      <span>{label}</span>
      <span
        className={cn(
          "rounded-sm px-1.5 py-0.5 text-caption tabular-nums",
          active ? "bg-accent/10 text-accent" : "bg-surface-sunken text-ink"
        )}
      >
        {count}
      </span>
    </button>
  );
}
