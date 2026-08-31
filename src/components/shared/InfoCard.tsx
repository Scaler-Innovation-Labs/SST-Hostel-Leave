import type React from "react";

import { cn } from "@/lib/utils";

const TONE_STYLES = {
  primary: {
    chip: "bg-primary/10 text-primary",
    bar: "from-primary/50 to-primary/10",
    tint: "bg-primary/[0.02]",
  },
  success: {
    chip: "bg-success-light text-success",
    bar: "from-success/50 to-success/10",
    tint: "bg-success/[0.02]",
  },
  warning: {
    chip: "bg-warning-light text-warning",
    bar: "from-warning/50 to-warning/10",
    tint: "bg-warning/[0.02]",
  },
  danger: {
    chip: "bg-danger-light text-danger",
    bar: "from-danger/50 to-danger/10",
    tint: "bg-danger/[0.02]",
  },
} as const;

type InfoCardTone = keyof typeof TONE_STYLES;

type InfoCardProps = {
  icon?: React.ReactNode;
  label: string;
  value: string | number;
  tone?: InfoCardTone;
  className?: string;
  /** Compact sizing for dense layouts / filter chips. */
  compact?: boolean;
  /** Makes the card clickable (e.g. acting as a filter toggle). */
  onClick?: () => void;
  /** Highlighted selection state, used with onClick. */
  active?: boolean;
};

export function InfoCard({ icon, label, value, tone, className, compact, onClick, active }: InfoCardProps) {
  const toneStyles = tone ? TONE_STYLES[tone] : null;
  const clickable = typeof onClick === "function";

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      aria-pressed={clickable ? !!active : undefined}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-card transition-all duration-200",
        compact ? "p-3" : "p-4",
        toneStyles?.tint,
        clickable && "cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary ring-2 ring-primary/30 shadow-md"
          : clickable
            ? "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            : "border-border hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-0.5 bg-linear-to-r",
          toneStyles ? toneStyles.bar : "from-primary/40 to-primary/10",
        )}
      />
      <div className="flex items-center gap-3">
        {icon && (
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-lg",
              compact ? "size-6" : "size-8",
              toneStyles ? toneStyles.chip : "bg-surface-sunken text-muted",
            )}
          >
            {icon}
          </span>
        )}
        <span
          className={cn(
            "font-medium uppercase tracking-wider text-muted",
            compact ? "text-micro" : "text-caption",
          )}
        >
          {label}
        </span>
      </div>
      <p
        className={cn(
          "font-semibold tabular-nums",
          compact ? "mt-1.5 text-h3 max-sm:text-body-lg" : "mt-2 text-h2 max-sm:text-h3",
        )}
      >
        {value}
      </p>
    </div>
  );
}