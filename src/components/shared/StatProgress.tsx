import { cn } from "@/lib/utils";

type StatProgressProps = {
  label: string;
  value: number;
  total: number;
  tone?: "primary" | "success" | "warning" | "danger";
  className?: string;
};

const BAR_TONES = {
  primary: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

export function StatProgress({ label, value, total, tone = "primary", className }: StatProgressProps) {
  const percentage = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums text-foreground">{percentage}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", BAR_TONES[tone])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}