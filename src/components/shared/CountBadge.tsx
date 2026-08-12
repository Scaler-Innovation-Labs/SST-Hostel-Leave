"use client";

import { cn } from "@/lib/utils";

type CountBadgeProps = {
  count: number;
  tone?: "amber" | "red" | "blue";
  className?: string;
};

const TONES: Record<NonNullable<CountBadgeProps["tone"]>, string> = {
  amber: "bg-amber-500/15 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  red: "bg-red-500/15 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  blue: "bg-blue-500/15 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
};

/**
 * Small pill showing a live count, hidden when the count is zero.
 * Used for nav badges (approvals, extensions, overdue).
 */
export function CountBadge({ count, tone = "amber", className }: CountBadgeProps) {
  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold leading-none tabular-nums",
        TONES[tone],
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
