import { cn } from "@/lib/utils";

type StatProgressProps = {
  label: string;
  value: number;
  total: number;
  tone?: "accent" | "success" | "warning" | "danger";
  className?: string;
};

const BAR_TONES = {
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

export function StatProgress({
  label,
  value,
  total,
  tone = "accent",
  className,
}: StatProgressProps) {
  const percentage =
    total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-caption">
        <span className="text-muted">{label}</span>
        {/* States the threshold, not just the share of it. */}
        <span className="font-medium tabular-nums text-ink">
          {value} of {total}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={label}
        className="h-1.5 overflow-hidden rounded-full bg-surface-sunken"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-slow ease-standard",
            BAR_TONES[tone]
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
