"use client";

import { Clock, Hourglass, TimerOff } from "lucide-react";

import { cn } from "@/lib/utils";

type ApprovalMetricCardsProps = {
  pendingCount: number;
  approvedToday: number;
  rejectedToday: number;
  averageSlaHours: number | null;
  overdueCount: number;
  parentPendingCount: number;
  className?: string;
};

export function ApprovalMetricCards({
  pendingCount,
  approvedToday,
  rejectedToday,
  averageSlaHours,
  overdueCount,
  parentPendingCount,
  className,
}: ApprovalMetricCardsProps) {
  const metrics = [
    {
      label: "Pending",
      value: pendingCount,
      icon: Hourglass,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    {
      label: "Approved Today",
      value: approvedToday,
      icon: Clock,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Rejected Today",
      value: rejectedToday,
      icon: TimerOff,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      label: "Avg Approval Time",
      value: averageSlaHours != null ? `${averageSlaHours}h` : "—",
      icon: Clock,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    {
      label: "Overdue",
      value: overdueCount,
      icon: TimerOff,
      color: "text-red-500",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    },
    {
      label: "Parent Pending",
      value: parentPendingCount,
      icon: Clock,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      border: "border-violet-500/20",
    },
  ];

  return (
    <div className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6", className)}>
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className={cn(
              "rounded-xl border p-3 transition-all hover:shadow-sm",
              metric.bg,
              metric.border,
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className={cn("h-3.5 w-3.5", metric.color)} />
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {metric.label}
              </span>
            </div>
            <p className={cn("mt-1 text-xl font-semibold", metric.color)}>
              {metric.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}
