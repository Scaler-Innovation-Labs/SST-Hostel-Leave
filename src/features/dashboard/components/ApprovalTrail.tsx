import { Check, ChevronRight, Clock, X, Zap } from "lucide-react";

import type { ApprovalStep } from "@/dto/dashboard/dashboard-stats.dto";
import { cn } from "@/lib/utils";

const STEP = {
  APPROVED: { Icon: Check, tone: "bg-success-light text-success" },
  AUTO_APPROVED: { Icon: Zap, tone: "bg-success-light text-success" },
  REJECTED: { Icon: X, tone: "bg-danger-light text-danger" },
  CANCELLED: { Icon: X, tone: "bg-surface-sunken text-muted" },
  PENDING: { Icon: Clock, tone: "bg-surface-sunken text-muted" },
} as const;

function stepPresentation(decision: string) {
  return STEP[decision as keyof typeof STEP] ?? STEP.PENDING;
}

/**
 * Where a request has got to in its approval chain.
 *
 * The chain comes from the workflow configuration, so this renders whatever
 * steps the request actually has rather than assuming Parent → Warden.
 */
export function ApprovalTrail({ steps }: { steps: ApprovalStep[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {steps.map((step, index) => {
        const { Icon, tone } = stepPresentation(step.decision);

        return (
          <li key={step.stepKey} className="flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-caption font-medium",
                tone
              )}
            >
              <Icon className="h-3 w-3 shrink-0" aria-hidden />
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight
                className="h-3 w-3 shrink-0 text-muted/40"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
