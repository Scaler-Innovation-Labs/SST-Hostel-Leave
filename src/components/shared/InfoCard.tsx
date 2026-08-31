import type React from "react";

import { FOCUS } from "@/design-system/sst";
import { cn } from "@/lib/utils";

/**
 * Per the colour rule the value stays ink and the colour lives in the icon —
 * a tile is not "the red one", it is a number with a red marker.
 */
const ICON_TONE = {
  accent: "bg-accent-light text-accent ring-accent/10",
  success: "bg-success-light text-success ring-success/10",
  warning: "bg-warning-light text-warning ring-warning/10",
  danger: "bg-danger-light text-danger ring-danger/10",
} as const;

type InfoCardTone = keyof typeof ICON_TONE;

type InfoCardProps = {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  tone?: InfoCardTone;
  className?: string;
  /** Denser sizing for a filter strip above a table. */
  compact?: boolean;
  /** Makes the tile a filter toggle. */
  onClick?: () => void;
  /** Selected state, used with onClick. */
  active?: boolean;
};

/**
 * The metric tile: mono caption, icon at the end, one value size, tabular
 * figures. No accent bar — an accent stripe on every card is decoration, and
 * six of them in a row is a stripe pattern rather than a hierarchy.
 */
export function InfoCard({
  icon,
  label,
  value,
  tone,
  className,
  compact,
  onClick,
  active,
}: InfoCardProps) {
  const clickable = typeof onClick === "function";
  const Element = clickable ? "button" : "div";

  return (
    <Element
      type={clickable ? "button" : undefined}
      onClick={onClick}
      aria-pressed={clickable ? Boolean(active) : undefined}
      className={cn(
        "rounded-2xl border bg-surface text-left shadow-raised",
        compact ? "p-3" : "p-5",
        clickable && [
          "cursor-pointer select-none transition-all duration-base ease-standard",
          "hover:-translate-y-0.5 hover:border-accent/30 hover:shadow-raised-lift active:translate-y-px",
          FOCUS,
        ],
        active
          ? "border-accent ring-1 ring-inset ring-accent/30"
          : "border-border",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-mono text-micro uppercase tracking-wider text-muted">
          {label}
        </span>
        {icon && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
              compact ? "h-6 w-6" : "h-8 w-8",
              tone ? ICON_TONE[tone] : "bg-surface-sunken text-muted ring-border",
              "[&_svg]:h-4 [&_svg]:w-4"
            )}
          >
            {icon}
          </span>
        )}
      </div>

      <p
        className={cn(
          "mt-2 font-semibold tabular-nums tracking-tight text-ink",
          compact ? "text-h3" : "text-h2"
        )}
      >
        {value}
      </p>
    </Element>
  );
}
