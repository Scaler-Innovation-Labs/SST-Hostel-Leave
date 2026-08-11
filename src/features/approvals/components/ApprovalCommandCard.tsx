"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Globe,
  Home,
  MapPin,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { AutoPreviewModal } from "./AutoPreviewModal";
import { WorkflowProgress } from "./WorkflowProgress";

type ApprovalCommandCardProps = {
  item: ApprovalQueueItem;
  onActionComplete: () => void;
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "MMM d");
}

function getDuration(startAt: Date | string, endAt: Date | string): string {
  try {
    const start = typeof startAt === "string" ? parseISO(startAt) : startAt;
    const end = typeof endAt === "string" ? parseISO(endAt) : endAt;
    const diffMs = end.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "Same day";
    return `${days}d`;
  } catch {
    return "—";
  }
}

function getWaitingTime(createdAt: string | Date): string {
  try {
    const date = typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500/10 text-blue-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-amber-500/10 text-amber-600",
  "bg-rose-500/10 text-rose-600",
];

export function ApprovalCommandCard({ item, onActionComplete }: ApprovalCommandCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lr = item.leaveRequest;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;
  const isApproved = item.decision === LEAVE_APPROVAL_DECISION.APPROVED || item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED;

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showPreview, setShowPreview] = useState<"approve" | "reject" | null>(null);

  const destination = lr?.submittedForm?.destination as string | undefined;
  const parentPending = !!item.approverParentId && !item.parentApprovalVerifiedAt;
  const waitingOn = lr?.currentStepKey ?? (lr?.status === LEAVE_REQUEST_STATUS.PENDING ? VIEW_STEP_KEY.POLICY : VIEW_STEP_KEY.COMPLETE);
  const isExtension = !!item.leaveExtensionId;

  // The leave is still waiting on an earlier step (parent or POC) — not this approver's turn yet.
  const showWaitingPanel =
    (waitingOn.includes("PARENT") && parentPending) || waitingOn.includes("POC");

  const avatarColor = AVATAR_COLORS[Math.abs((item.studentName ?? "").charCodeAt(0) || 0) % 5] ?? "bg-muted text-muted-foreground";

  function getStepDisplay(stepKey: string | null): { label: string } {
    const key = stepKey ?? "";
    if (key === "" || key === VIEW_STEP_KEY.SUBMITTED || key === VIEW_STEP_KEY.POLICY) return { label: "Policy Check" };
    if (key.includes("PARENT")) return { label: "Parent Approval" };
    if (key.includes("POC")) return { label: "Hostel Approval" };
    if (key.includes("ADMIN")) return { label: "College Approval" };
    if (key.includes(VIEW_STEP_KEY.COMPLETE)) return { label: "Completed" };
    return { label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown" };
  }

  const isComplete = lr?.status === LEAVE_REQUEST_STATUS.APPROVED || lr?.status === LEAVE_REQUEST_STATUS.COMPLETED || lr?.status === LEAVE_REQUEST_STATUS.REJECTED;
  const normalizedStepKey = (waitingOn ?? "").trim();
  const stepDefs = [
    { match: (s: string) => s === "" || s === VIEW_STEP_KEY.SUBMITTED || s === VIEW_STEP_KEY.POLICY, label: "Submitted" },
    { match: (s: string) => s.includes(VIEW_STEP_KEY.POLICY), label: "Policy Check" },
    { match: (s: string) => s.includes("PARENT"), label: "Parent" },
    { match: (s: string) => s.includes("POC"), label: "Hostel" },
    { match: (s: string) => s.includes("ADMIN"), label: "College" },
    { match: (s: string) => s.includes(VIEW_STEP_KEY.COMPLETE), label: "Done" },
  ];
  const currentStepIdx = stepDefs.findIndex((s) => s.match(normalizedStepKey));
  const workflowSteps = stepDefs.map((step, idx) => {
    let status: "completed" | "current" | "pending" | "failed";
    if (isComplete && lr?.status === LEAVE_REQUEST_STATUS.REJECTED) {
      status = "failed";
    } else if (isComplete || (currentStepIdx >= 0 && idx < currentStepIdx)) {
      status = "completed";
    } else if (currentStepIdx >= 0 && idx === currentStepIdx && !isComplete) {
      status = "current";
    } else {
      status = "pending";
    }
    return { key: step.label.toLowerCase().replace(/\s+/g, "-"), label: step.label, status };
  });

  const handleAction = async (action: "approve" | "reject") => {
    if (!lr) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (action === "approve") {
        await approveLeave(lr.id);
      } else {
        await rejectLeave(lr.id);
      }
      onActionComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-sm transition-all hover:shadow-md cursor-pointer"
      onClick={() => {
        if (lr?.id) router.push(`${pathname.replace(/\/+$/, "")}/${lr.id}`);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && lr?.id) {
          router.push(`${pathname.replace(/\/+$/, "")}/${lr.id}`);
        }
      }}
    >
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            isPending ? "bg-amber-500/10 text-amber-600" : isApproved ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isPending ? "bg-amber-500" : isApproved ? "bg-emerald-500" : "bg-red-500")} />
            {isPending ? "PENDING" : isApproved ? "APPROVED" : "REJECTED"}
          </span>
          {isExtension && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">Extension</span>
          )}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{lr?.requestNumber ?? "—"}</span>
      </div>

      {/* ── Card body ── */}
      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        {/* Left — request details */}
        <div className="min-w-0 flex-1 space-y-3">
          {/* Student + Leave row */}
          <div className="flex items-start gap-3">
            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold", avatarColor)}>
              {getInitials(item.studentName ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold leading-tight">{item.studentName ?? "—"}</h3>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                <span className="font-mono">{item.studentRollNumber}</span>
                {item.departmentName && <span>{item.departmentName}</span>}
                {item.roomNumber && <span>Room {item.roomNumber}</span>}
                {item.hostelName && (
                  <span className="inline-flex items-center gap-1">
                    <Home className="h-3 w-3" />
                    {item.hostelName}
                  </span>
                )}
              </div>
            </div>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {getWaitingTime(item.createdAt)}
            </span>
          </div>

          {/* Leave summary — compact horizontal */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Globe className="h-3.5 w-3.5" />
              {item.leaveTypeName ?? "Leave"}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {lr ? `${formatDate(lr.startAt)}→${formatDate(lr.endAt)}` : "—"}
              <span className="ml-0.5 rounded bg-muted px-1 py-0.5 text-[10px] font-medium">
                {lr ? getDuration(lr.startAt, lr.endAt) : ""}
              </span>
            </span>
            {destination && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {destination}
              </span>
            )}
          </div>

          {/* Reason */}
          <div className="line-clamp-1 text-xs text-muted-foreground">
            {lr?.reason ?? "—"}
          </div>

        </div>

        {/* Middle — workflow progress */}
        <div className="flex items-center justify-center sm:flex-1 sm:px-6">
          <WorkflowProgress steps={workflowSteps} compact />
        </div>

        {/* Right — actions / status */}
        <div className="flex shrink-0 items-center justify-center sm:w-44">
          {isPending ? (
            <div className="flex w-full flex-col gap-2">
              {showWaitingPanel ? (
                <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-3 text-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <span className="text-[11px] font-medium leading-tight text-muted-foreground">
                    Waiting for <span className="text-foreground">{getStepDisplay(waitingOn).label}</span>
                  </span>
                </div>
              ) : (
                <>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview("approve");
                    }}
                    disabled={actionLoading}
                    className="h-8 w-full gap-1.5 text-xs"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPreview("reject");
                    }}
                    disabled={actionLoading}
                    className="h-8 w-full gap-1.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Reject
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              {isApproved ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={cn("text-xs font-semibold uppercase tracking-wide", isApproved ? "text-emerald-600" : "text-red-600")}>
                {isApproved ? "Approved" : "Rejected"}
              </span>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="border-t border-border px-4 py-3">
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {actionError}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showPreview && (
        <AutoPreviewModal
          open={!!showPreview}
          onOpenChange={() => setShowPreview(null)}
          action={showPreview}
          studentName={item.studentName ?? "this student"}
          onConfirm={() => {
            setShowPreview(null);
            handleAction(showPreview);
          }}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
