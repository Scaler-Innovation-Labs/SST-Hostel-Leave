"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Globe,
  Home,
  MapPin,
  MessageSquare,
  Shield,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { AuditDrawer } from "./AuditDrawer";
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

function formatPolicyValue(check: { key: string; passed: boolean | undefined; detail?: string }): string {
  if (check.detail) return check.detail;
  if (check.passed === true) return "Passed ✓";
  if (check.passed === false) return "Failed";
  return "—";
}

export function ApprovalCommandCard({ item, onActionComplete }: ApprovalCommandCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const lr = item.leaveRequest;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;
  const isApproved = item.decision === LEAVE_APPROVAL_DECISION.APPROVED || item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED;

  const [showPolicy, setShowPolicy] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showPreview, setShowPreview] = useState<"approve" | "reject" | null>(null);
  const [confirmAction, setConfirmAction] = useState<"approve" | "reject" | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [internalNote, setInternalNote] = useState(false);

  const destination = lr?.submittedForm?.destination as string | undefined;
  const parentPending = !!item.approverParentId && !item.parentApprovalVerifiedAt;
  const waitingOn = lr?.currentStepKey ?? (lr?.status === LEAVE_REQUEST_STATUS.PENDING ? VIEW_STEP_KEY.POLICY : VIEW_STEP_KEY.COMPLETE);
  const isExtension = !!item.leaveExtensionId;

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

  // ── Policy evaluation ──
  const policyChecks = (lr?.policyResult as { checks?: Array<{ key: string; label: string; passed: boolean; message?: string }> } | null)?.checks?.map((c) => ({
    key: c.key,
    displayKey: c.label,
    passed: c.passed,
    detail: c.message,
  })) ?? [];

  // ── Audit entries ──
  const auditEntries = [
    { label: "Student Created", time: lr?.createdAt ?? null, status: "done" as const },
    { label: "Policy Evaluated", time: lr?.createdAt ?? null, status: "done" as const },
    { label: "Workflow Generated", time: lr?.createdAt ?? null, status: "done" as const },
    ...(item.parentApprovalVerifiedAt ? [{ label: "Parent Approved", time: item.parentApprovalVerifiedAt, status: "done" as const }] : []),
    ...(isPending ? [{ label: `Waiting for ${getStepDisplay(waitingOn).label}`, time: null, status: "pending" as const }] : []),
  ];

  const handleAction = async (action: "approve" | "reject") => {
    if (!lr) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (action === "approve") {
        await approveLeave(lr.id, comments || undefined, internalNote || undefined);
      } else {
        await rejectLeave(lr.id, comments || undefined, internalNote || undefined);
      }
      setComments("");
      setInternalNote(false);
      setShowComments(false);
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
          {isPending && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              Waiting: <span className="font-medium text-foreground">{getStepDisplay(waitingOn).label}</span>
            </span>
          )}
          {isExtension && (
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">Extension</span>
          )}
        </div>
        <span className="font-mono text-xs text-muted-foreground">{lr?.requestNumber ?? "—"}</span>
      </div>

      {/* ── LEVEL 1 — Always visible (~300px) ── */}
      <div className="space-y-3 p-4">
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

        {/* Compact workflow */}
        <WorkflowProgress steps={workflowSteps} compact />

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-2 pt-1">
            {waitingOn.includes("PARENT") && parentPending ? (
              <Button variant="outline" disabled className="gap-2 text-xs h-8 opacity-60" onClick={(e) => e.stopPropagation()}>
                <Clock className="h-3.5 w-3.5" />
                Waiting for Parent
              </Button>
            ) : (
              <>
                <Button
                  variant="destructive" size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!comments.trim()) { setShowComments(true); return; }
                    setShowPreview("reject");
                  }}
                  disabled={actionLoading}
                  className="gap-1 h-8 text-xs"
                >
                  <XCircle className="h-3.5 w-3.5" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPreview("approve");
                  }}
                  disabled={actionLoading}
                  className="gap-1 h-8 text-xs"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Approve
                </Button>
              </>
            )}
          </div>
        )}

        {!isPending && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={(e) => { e.stopPropagation(); setShowAudit(true); }}>
              <ExternalLink className="h-3.5 w-3.5" />
              View Audit
            </Button>
          </div>
        )}

        {actionError && (
          <div className="rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">
            {actionError}
          </div>
        )}
      </div>

      {/* ── LEVEL 2 — Collapsible sections ── */}
      <div className="border-t border-border px-4 py-2 space-y-1">
        {/* Policy Evaluation */}
        {policyChecks.length > 0 && (
          <div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowPolicy(!showPolicy); }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              {showPolicy ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <Shield className="h-3 w-3" />
              Policy Evaluation
              <span className="ml-auto text-[10px] text-muted-foreground">
                {policyChecks.filter(c => c.passed !== false).length}/{policyChecks.length} passed
              </span>
            </button>
            {showPolicy && (
              <div className="mt-1 grid grid-cols-2 gap-1 px-2 pb-2">
                {policyChecks.map((check) => (
                  <div key={check.key} className={cn(
                    "flex items-center justify-between rounded-lg px-3 py-1.5 text-xs",
                    check.passed === true ? "bg-emerald-500/5" : check.passed === undefined ? "bg-muted/30" : "bg-red-500/5",
                  )}>
                    <span className="font-medium">{check.displayKey}</span>
                    <span className={cn("ml-2 shrink-0 text-right", check.passed === true ? "text-emerald-600" : check.passed === undefined ? "text-muted-foreground" : "text-red-600")}>
                      {formatPolicyValue(check)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Parent status (compact) */}
        {item.approverParentId && (
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs">
            {item.parentApprovalVerifiedAt ? (
              <>
                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-600 font-medium">Parent Approved</span>
              </>
            ) : (
              <>
                <Clock className="h-3 w-3 text-amber-500" />
                <span className="text-amber-600 font-medium">Parent pending</span>
                <span className="text-muted-foreground">· {item.parentName ?? ""}</span>
              </>
            )}
          </div>
        )}

        {/* Comments */}
        {isPending && (
          <div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setShowComments(!showComments); }}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              {showComments ? "Hide" : "Add"} comment
              {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showComments && (
              <div className="mt-1 space-y-2 px-2 pb-2">
                <textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Add a note about your decision..."
                  rows={2}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={internalNote} onChange={(e) => setInternalNote(e.target.checked)} className="rounded border-border" />
                  Internal note (not visible to student)
                </label>
              </div>
            )}
          </div>
        )}

        {/* Audit trigger */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setShowAudit(true); }}
          className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
        >
          <Clock className="h-3 w-3" />
          View Audit
        </button>
      </div>

      {/* ── LEVEL 3 — Modals ── */}
      <AuditDrawer
        open={showAudit}
        onOpenChange={setShowAudit}
        entries={auditEntries}
      />

      {showPreview && (
        <AutoPreviewModal
          open={!!showPreview}
          onOpenChange={() => setShowPreview(null)}
          action={showPreview}
          studentName={item.studentName ?? "this student"}
          onConfirm={() => {
            setShowPreview(null);
            if (showPreview === "reject" && !comments.trim()) { setShowComments(true); return; }
            handleAction(showPreview);
          }}
          loading={actionLoading}
        />
      )}

      {!showPreview && (
        <ConfirmationDialog
          open={!!confirmAction}
          onOpenChange={() => setConfirmAction(null)}
          title={confirmAction === "approve" ? "Approve Leave" : "Reject Leave"}
          description={comments ? `${confirmAction === "approve" ? "Approve" : "Reject"} this leave with your comment: "${comments}"` : `Are you sure you want to ${confirmAction} this leave request?`}
          confirmLabel={confirmAction === "approve" ? "Approve" : "Reject"}
          variant={confirmAction === "reject" ? "destructive" : "default"}
          onConfirm={() => { if (confirmAction) handleAction(confirmAction); setConfirmAction(null); }}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
