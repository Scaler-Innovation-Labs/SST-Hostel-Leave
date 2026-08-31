"use client";

import { cn } from "@/lib/utils";

type CountBadgeProps = {
  count: number;
  /**
   * How urgent the queue is. `danger` is for work that is already late;
   * `warning` for work that is waiting on you.
   */
  tone?: "warning" | "danger" | "accent";
  className?: string;
};

const TONES: Record<NonNullable<CountBadgeProps["tone"]>, string> = {
  warning: "bg-warning text-on-fill",
  danger: "bg-danger text-on-fill",
  accent: "bg-accent text-on-fill",
};

/**
 * A live count, hidden when it is zero — an empty queue should not carry a
 * badge saying so. Bold is reserved for exactly this: notification counts.
 */
export function CountBadge({
  count,
  tone = "warning",
  className,
}: CountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5",
        "text-micro font-bold leading-none tabular-nums",
        TONES[tone],
        className
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
