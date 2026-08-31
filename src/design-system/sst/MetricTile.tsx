import * as React from "react";

import { cn } from "@/lib/utils";

type MetricTone = "accent" | "success" | "warning" | "danger" | "info";

const ICON_TONE: Record<MetricTone, string> = {
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

type MetricTileProps = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /**
   * Per the colour rule the value stays ink and the colour moves to the icon —
   * a tile is not "the red one", it is a number with a red marker.
   */
  tone?: MetricTone;
  className?: string;
};

function MetricTile({
  label,
  value,
  unit,
  Icon,
  tone,
  className,
}: MetricTileProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-5 shadow-raised",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-micro uppercase tracking-wider text-muted">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4 shrink-0",
            tone ? ICON_TONE[tone] : "text-muted/50"
          )}
          aria-hidden
        />
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-h2 font-semibold tabular-nums tracking-tight text-ink">
          {value}
        </span>
        {unit && (
          <span className="text-body tabular-nums text-muted">{unit}</span>
        )}
      </p>
    </div>
  );
}

/**
 * The grid a row of tiles sits in. Two tiles read as a pair, three as a row,
 * four or more wrap two-up on mobile rather than shrinking to unreadable.
 */
function metricGridClass(count: number): string {
  if (count <= 2) return "grid grid-cols-1 gap-4 sm:grid-cols-2";
  if (count === 3) return "grid grid-cols-1 gap-4 sm:grid-cols-3";
  return "grid grid-cols-2 gap-4 lg:grid-cols-4";
}

export { metricGridClass,MetricTile };
export type { MetricTileProps, MetricTone };
