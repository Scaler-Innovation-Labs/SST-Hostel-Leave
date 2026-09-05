import { Building2, CheckCircle2, Clock, FileText, Shield, User } from "lucide-react";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { VIEW_STEP_KEY, WORKFLOW_STEP_KEY, WORKFLOW_STEP_KEYS } from "@/constants/workflow/workflow-step-key";
import type { ApprovalStepBreakdownEntry } from "@/types/leave/approval-step-breakdown";

/** How one workflow step reads in a queue: label, icon and its tone. */
export type StepDisplay = {
  icon: React.ReactNode;
  label: string;
  color: string;
  bgClass: string;
};

/** Maps a DB step key to its human-readable label and icon. */
export function getStepDisplay(stepKey: string | null): StepDisplay {
  const key = stepKey ?? "";
  if (key === "" || key === VIEW_STEP_KEY.SUBMITTED || key === VIEW_STEP_KEY.POLICY)
    return {
      icon: <FileText className="h-4 w-4" />,
      label: "Policy Check",
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === WORKFLOW_STEP_KEY.PARENT_APPROVAL || key.includes(WORKFLOW_STEP_KEY.PARENT_APPROVAL))
    return {
      icon: <User className="h-4 w-4" />,
      label: "Parent Approval",
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === WORKFLOW_STEP_KEY.POC_APPROVAL || key.includes(WORKFLOW_STEP_KEY.POC_APPROVAL))
    return {
      icon: <Shield className="h-4 w-4" />,
      label: "POC Approval",
      color: "text-warning",
      bgClass: "bg-warning-light hover:bg-warning-light border-warning/40 dark:border-warning/30",
    };
  if (key === WORKFLOW_STEP_KEY.ADMIN_APPROVAL || key.includes(WORKFLOW_STEP_KEY.ADMIN_APPROVAL))
    return {
      icon: <Building2 className="h-4 w-4" />,
      label: "Admin Approval",
      color: "text-accent",
      bgClass: "bg-accent-light hover:bg-accent-light border-accent/40 dark:border-accent/30",
    };
  if (key === VIEW_STEP_KEY.COMPLETE || key.includes(VIEW_STEP_KEY.COMPLETE))
    return {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: "Completed",
      color: "text-success",
      bgClass: "bg-success-light hover:bg-success-light border-success/40 dark:border-success/30",
    };
  // Fallback: clean up snake_case key
  const fallbackLabel = key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    icon: <Clock className="h-4 w-4" />,
    label: fallbackLabel || "Unknown",
    color: "text-muted",
    bgClass: "bg-surface-sunken hover:bg-surface-hover border-border",
  };
}

/** The label a step key carries inside the "Waiting On" filter. */
export function stepKeyToFilterLabel(stepKey: string): string {
  if (stepKey === "") return "All Status";
  if (stepKey === VIEW_STEP_KEY.COMPLETE) return "Completed";
  return getStepDisplay(stepKey).label;
}

const STEP_ORDER: readonly string[] = [VIEW_STEP_KEY.POLICY, ...WORKFLOW_STEP_KEYS];

/** Chips read left to right along the approval chain, not by count. */
export function sortByStepOrder(
  entries: ApprovalStepBreakdownEntry[]
): ApprovalStepBreakdownEntry[] {
  const rank = (stepKey: string) => {
    const index = STEP_ORDER.indexOf(stepKey);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return [...entries].sort((a, b) => rank(a.stepKey) - rank(b.stepKey));
}

/**
 * Counts waiting-on steps from a list of approvals already in hand.
 *
 * Only for views the API cannot express (the overdue queue). Everywhere else
 * the breakdown comes from the server, so that selecting a step cannot change
 * the counts reported by the others.
 */
export function countPendingByStep(
  approvals: Array<{ decision: string; stepKey: string | null }>
): ApprovalStepBreakdownEntry[] {
  const counts = new Map<string, number>();
  for (const approval of approvals) {
    if (approval.decision !== LEAVE_APPROVAL_DECISION.PENDING) continue;
    const stepKey = approval.stepKey || VIEW_STEP_KEY.POLICY;
    counts.set(stepKey, (counts.get(stepKey) ?? 0) + 1);
  }
  return [...counts.entries()].map(([stepKey, count]) => ({ stepKey, count }));
}

/**
 * The step keys the "Waiting On" filter offers, in chain order.
 *
 * COMPLETE is dropped: the filter carries it as a fixed option of its own, and
 * a workflow configured with a COMPLETE step would otherwise list it twice.
 */
export function toWaitingOnStepKeys(entries: ApprovalStepBreakdownEntry[]): string[] {
  return entries
    .map((entry) => entry.stepKey)
    .filter((stepKey) => stepKey !== VIEW_STEP_KEY.COMPLETE);
}
