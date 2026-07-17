"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";

export type WorkflowStep = {
  id: string;
  stepKey: string;
  stepOrder: number;
  decision: string;
  approverRoleCode: string | null;
  approverName?: string | null;
  comments?: string | null;
  createdAt?: string | Date | null;
  isCurrent?: boolean;
};

type WorkflowTimelineProps = {
  steps: WorkflowStep[];
  className?: string;
};

const DECISION_CONFIG = {
  approved: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bg: "bg-emerald-500",
    lightBg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    label: "Approved",
  },
  auto_approved: {
    icon: CheckCircle2,
    color: "text-blue-500",
    bg: "bg-blue-500",
    lightBg: "bg-blue-500/10",
    border: "border-blue-500/30",
    label: "Auto Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500",
    lightBg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Rejected",
  },
  cancelled: {
    icon: XCircle,
    color: "text-gray-500",
    bg: "bg-gray-500",
    lightBg: "bg-gray-500/10",
    border: "border-gray-500/30",
    label: "Cancelled",
  },
  pending: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500",
    lightBg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Pending",
  },
} as const;

function getStepKeyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function WorkflowTimeline({ steps, className }: WorkflowTimelineProps) {
  if (steps.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No workflow steps defined.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {steps.map((step, i) => {
        const decision = step.decision?.toLowerCase() as keyof typeof DECISION_CONFIG;
        const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.pending;
        const Icon = config.icon;
        const isLast = i === steps.length - 1;
        const isCurrent = step.isCurrent || (decision === "pending");

        return (
          <div key={step.id} className="relative flex gap-3">
            {/* Timeline dot + connector */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isCurrent
                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                    : decision === "approved" || decision === "auto_approved"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : decision === "rejected" || decision === "cancelled"
                    ? "border-red-500 bg-red-500/10"
                    : "border-border bg-muted",
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", config.color)} />
              </div>
              {!isLast && (
                <div
                  className={cn(
                    "h-full w-0.5",
                    decision === "approved" || decision === "auto_approved"
                      ? "bg-emerald-200 dark:bg-emerald-800"
                      : decision === "rejected" || decision === "cancelled"
                      ? "bg-red-200 dark:bg-red-800"
                      : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Step content */}
            <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn(
                  "text-sm font-medium",
                  isCurrent && "text-amber-600 dark:text-amber-400",
                )}>
                  {getStepKeyLabel(step.stepKey)}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    config.lightBg,
                    config.color,
                  )}
                >
                  {config.label}
                </span>
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span>Role: {step.approverRoleCode ?? "—"}</span>
                {step.approverName && (
                  <span>· {step.approverName}</span>
                )}
                {step.createdAt && (
                  <span>· {typeof step.createdAt === "string" ? new Date(step.createdAt).toLocaleString() : step.createdAt.toLocaleString()}</span>
                )}
              </div>

              {step.comments && (
                <div className="mt-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
                  "{step.comments}"
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
