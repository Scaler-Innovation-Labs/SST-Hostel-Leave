"use client";

import { CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type WorkflowStep = {
  key: string;
  label: string;
  status: "completed" | "current" | "pending" | "failed";
  timestamp?: string;
};

type WorkflowProgressProps = {
  steps: WorkflowStep[];
  className?: string;
  compact?: boolean;
};

function DotIcon({ status }: { status: WorkflowStep["status"] }) {
  if (status === "completed") return <CheckCircle2 className="h-3 w-3" />;
  if (status === "current") return <CircleDot className="h-3 w-3" />;
  if (status === "failed") return <XCircle className="h-3 w-3" />;
  return <Circle className="h-3 w-3" />;
}

function dotColor(status: WorkflowStep["status"]) {
  switch (status) {
    case "completed": return "text-emerald-500";
    case "current": return "text-amber-500";
    case "failed": return "text-red-500";
    default: return "text-muted-foreground";
  }
}

export function WorkflowProgress({ steps, className, compact }: WorkflowProgressProps) {
  if (steps.length === 0) return null;
  if (compact) {
    return (
      <div className={cn("flex items-center gap-0.5", className)} title={steps.map(s => `${s.label}: ${s.status}`).join(" | ")}>
        {steps.map((step, i) => (
          <span key={step.key} className="flex items-center">
            <span className={cn(dotColor(step.status))}>
              <DotIcon status={step.status} />
            </span>
            {i < steps.length - 1 && (
              <span className={cn("mx-0.5 h-px w-3", step.status === "completed" ? "bg-emerald-400" : "bg-border")} />
            )}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;

          return (
            <div key={step.key} className={cn("flex items-center", isLast ? "" : "flex-1")}>
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-all",
                    step.status === "completed"
                      ? "bg-emerald-500 text-white"
                      : step.status === "current"
                      ? "bg-amber-500 text-white ring-2 ring-amber-500/30"
                      : step.status === "failed"
                      ? "bg-red-500 text-white"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {step.status === "completed" ? (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  ) : step.status === "current" ? (
                    <CircleDot className="h-3.5 w-3.5" />
                  ) : (
                    <Circle className="h-3.5 w-3.5" />
                  )}
                </div>
                <span
                  className={cn(
                    "whitespace-nowrap text-[10px] font-medium",
                    step.status === "completed"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : step.status === "current"
                      ? "text-amber-600 dark:text-amber-400"
                      : step.status === "failed"
                      ? "text-red-600 dark:text-red-400"
                      : "text-muted-foreground",
                  )}
                >
                  {step.label}
                </span>
                {step.timestamp && (
                  <span className="text-[9px] text-muted-foreground">
                    {step.timestamp}
                  </span>
                )}
              </div>

              {!isLast && (
                <div
                  className={cn(
                    "mx-1 mt-[-1.5rem] h-0.5 flex-1",
                    step.status === "completed"
                      ? "bg-emerald-300 dark:bg-emerald-700"
                      : "bg-border",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
