"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  Clock,
  Home,
  Loader2,
  MapPin,
  XCircle,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { LeaveTypeBadge } from "@/components/shared/LeaveTypeBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { approveExtension } from "@/lib/api/extension-api";
import { softTint, topBannerGradient } from "@/lib/color-utils";
import { getDurationLabel } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { AutoPreviewModal } from "./AutoPreviewModal";
import { WorkflowProgress } from "./WorkflowProgress";

type ApprovalCommandCardProps = {
  item: ApprovalQueueItem;
  onActionComplete: () => void;
  /**
   * Base path for the detail page, e.g. "/admin/approvals". Defaults to the
   * current path, which is right on the approvals pages but wrong on other
   * pages that reuse this card (e.g. the overdue page).
   */
  hrefPrefix?: string;
  /**
   * Disable the click-through to a detail page. Used on pages that have no
   * detail route (e.g. extension approvals, which act inline).
   */
  disableNavigation?: boolean;
  /**
   * The current viewer's role. Defaults to "ADMIN" behavior: action buttons
   * are hidden while the leave waits on a parent or POC step (not your turn).
   * A POC viewer sees only their own assigned rows, so for them the buttons
   * must show on POC-waiting cards.
   */
  viewerRole?: "POC" | "ADMIN" | "SUPER_ADMIN";
};

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "MMM d");
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

function workflowStepLabel(stepKey: string): string {
  const key = stepKey ?? "";
  if (key.includes("PARENT")) return "Parent";
  if (key.includes("POC")) return "POC";
  if (key.includes("ADMIN")) return "Admin";
  if (key.includes("AUTO")) return "Auto";
  const cleaned = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return cleaned || "Step";
}

export function ApprovalCommandCard({ item, onActionComplete, hrefPrefix, disableNavigation, viewerRole }: ApprovalCommandCardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const detailPrefix = hrefPrefix ?? pathname;
  const lr = item.leaveRequest;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;
  const isApproved = item.decision === LEAVE_APPROVAL_DECISION.APPROVED || item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED;
  const leaveStatus = lr?.status ?? null;
  const isLeavePending = leaveStatus === LEAVE_REQUEST_STATUS.PENDING;
  const headerBadge =
    isPending
      ? "PENDING"
      : leaveStatus === LEAVE_REQUEST_STATUS.PENDING
        ? isApproved
          ? "APPROVED"
          : "REJECTED"
        : leaveStatus ?? "DONE";

  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [showPreview, setShowPreview] = useState<"approve" | "reject" | null>(null);
  const [approveOpen, setApproveOpen] = useState(false);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [comments, setComments] = useState("");
  const [ccEmailsInput, setCcEmailsInput] = useState("");
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [notifyParent, setNotifyParent] = useState(true);
  const [documentsVerified, setDocumentsVerified] = useState(false);

  const destination = lr?.submittedForm?.destination as string | undefined;
  const waitingOn = lr?.currentStepKey ?? (lr?.status === LEAVE_REQUEST_STATUS.PENDING ? VIEW_STEP_KEY.POLICY : VIEW_STEP_KEY.COMPLETE);
  const isExtension = !!item.leaveExtensionId;
  const isSpecialLeave = (item.leaveTypeUiConfig?.isSpecial as boolean | undefined) ?? false;
  const isPocViewer = viewerRole === "POC";
  const leaveColor =
    typeof item.leaveTypeUiConfig?.color === "string" ? item.leaveTypeUiConfig.color : null;

  // Status color for the left rail — the decision at a glance.
  const statusColor =
    isPending
      ? "#f59e0b"
      : leaveStatus === LEAVE_REQUEST_STATUS.REJECTED ||
          leaveStatus === LEAVE_REQUEST_STATUS.CANCELLED ||
          leaveStatus === LEAVE_REQUEST_STATUS.EXPIRED ||
          leaveStatus === LEAVE_REQUEST_STATUS.OVERDUE
        ? "#ef4444"
        : "#10b981";

  // Role required by the currently active workflow step. When it doesn't match
  // this viewer's role, the approver's turn hasn't come yet — show a waiting
  // panel instead of action buttons (e.g. a POC who already approved now sees
  // "waiting on admin approval", not an Approve button).
  const currentStepRole =
    (item.workflowSteps ?? []).find((s) => s.stepKey === waitingOn)?.approverRoleCode ?? null;

  // Determine whether THIS viewer is the one whose action the current step
  // needs. Admin/super-admin pages don't pass a viewerRole, so default to
  // ADMIN there. A parent step has no role code (approverRoleCode null) — a
  // POC must wait on it, while an admin can override it.
  const effectiveViewerRole = viewerRole ?? "ADMIN";

  // Buttons only appear when the row itself is still pending, the leave is
  // still pending, AND the active step belongs to this viewer. A SUPER_ADMIN
  // acts on ADMIN steps (and SUPER_ADMIN steps if a workflow uses them); a
  // POC only on POC steps. Rows the viewer already decided (e.g. an approved
  // POC row while the leave waits on admin) show their decision instead.
  const isViewerTurn =
    isPending &&
    isLeavePending &&
    (currentStepRole === effectiveViewerRole ||
      (effectiveViewerRole === "SUPER_ADMIN" && currentStepRole === "ADMIN"));

  // A pending row waiting on an earlier step that isn't this approver's turn
  // — show a waiting panel instead of action buttons.
  const showWaitingPanel = isPending && isLeavePending && !isViewerTurn;

  const failedStepLabel =
    leaveStatus === LEAVE_REQUEST_STATUS.REJECTED
      ? (() => {
          const failedStep = (item.workflowSteps ?? []).find(
            (s) => s.stepOrder === lr?.currentStepOrder,
          );
          if (failedStep?.stepKey) return workflowStepLabel(failedStep.stepKey);
          if (waitingOn === VIEW_STEP_KEY.POLICY || waitingOn === VIEW_STEP_KEY.SUBMITTED)
            return "Policy";
          return null;
        })()
      : null;

  const avatarColor = AVATAR_COLORS[Math.abs((item.studentName ?? "").charCodeAt(0) || 0) % 5] ?? "bg-muted text-muted-foreground";

  function getStepDisplay(stepKey: string | null): { label: string } {
    const key = stepKey ?? "";
    if (key === "" || key === VIEW_STEP_KEY.SUBMITTED || key === VIEW_STEP_KEY.POLICY) return { label: "Policy Check" };
    if (key.includes("PARENT")) return { label: "Parent Approval" };
    if (key.includes("POC")) return { label: "POC Approval" };
    if (key.includes("ADMIN")) return { label: "Admin Approval" };
    if (key.includes(VIEW_STEP_KEY.COMPLETE)) return { label: "Completed" };
    return { label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown" };
  }

  const isComplete = lr?.status === LEAVE_REQUEST_STATUS.APPROVED || lr?.status === LEAVE_REQUEST_STATUS.COMPLETED || lr?.status === LEAVE_REQUEST_STATUS.REJECTED;
  const isRejected = lr?.status === LEAVE_REQUEST_STATUS.REJECTED;
  const currentOrder = lr?.currentStepOrder ?? null;
  const approvalSteps = (item.workflowSteps ?? []).map((step) => {
    let status: "completed" | "current" | "pending" | "failed";
    if (isComplete && !isRejected) {
      status = "completed";
    } else if (isRejected && currentOrder != null) {
      status =
        step.stepOrder === currentOrder
          ? "failed"
          : step.stepOrder < currentOrder
            ? "completed"
            : "pending";
    } else if (currentOrder != null) {
      status =
        step.stepOrder < currentOrder
          ? "completed"
          : step.stepOrder === currentOrder
            ? "current"
            : "pending";
    } else {
      status = step.stepOrder === 1 ? "current" : "pending";
    }
    return { key: step.stepKey, label: workflowStepLabel(step.stepKey), status };
  });

  const hasPolicy = lr?.policyResult != null;
  const waitingOnPolicy =
    waitingOn === VIEW_STEP_KEY.POLICY || waitingOn === VIEW_STEP_KEY.SUBMITTED || waitingOn === "";
  const policyStatus: "completed" | "current" = waitingOnPolicy ? "current" : "completed";
  const steps = [
    { key: "create", label: "Create", status: "completed" as const },
    ...(hasPolicy ? [{ key: "policy", label: "Policy", status: policyStatus }] : []),
    ...approvalSteps,
  ];

  const resetApproveForm = () => {
    setComments("");
    setCcEmailsInput("");
    setNotifyStudent(true);
    setNotifyParent(true);
    setDocumentsVerified(false);
  };

  const handleReject = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      if (isExtension && item.leaveExtensionId) {
        await approveExtension(item.leaveExtensionId, {
          decision: LEAVE_APPROVAL_DECISION.REJECTED,
        });
        toast.success("Extension rejected");
      } else {
        if (!lr) return;
        await rejectLeave(lr.id);
        toast.success("Leave rejected");
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

  const submitApprove = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const ccEmails = ccEmailsInput
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
      const result = isExtension && item.leaveExtensionId
        ? await approveExtension(item.leaveExtensionId, {
            decision: LEAVE_APPROVAL_DECISION.APPROVED,
            comments: comments || undefined,
          })
        : await approveLeave(
            lr!.id,
            comments || undefined,
            undefined,
            isSpecialLeave ? documentsVerified : undefined,
            ccEmails.length > 0 ? ccEmails : undefined
          );
      if ((result as { requiresConfirmation?: boolean })?.requiresConfirmation) {
        // Parent approval is still pending — ask for override confirmation.
        setApproveOpen(false);
        setOverrideOpen(true);
        return;
      }
      toast.success(isExtension ? "Extension approved successfully" : "Leave approved successfully");
      resetApproveForm();
      setApproveOpen(false);
      onActionComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  };

  const submitOverride = async () => {
    setActionLoading(true);
    setActionError("");
    try {
      const ccEmails = ccEmailsInput
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);
      if (isExtension && item.leaveExtensionId) {
        await approveExtension(item.leaveExtensionId, {
          decision: LEAVE_APPROVAL_DECISION.APPROVED,
          comments: comments || undefined,
          forceOverride: true,
        });
      } else {
        await approveLeave(
          lr!.id,
          comments || undefined,
          undefined,
          isSpecialLeave ? documentsVerified : undefined,
          ccEmails.length > 0 ? ccEmails : undefined,
          true
        );
      }
      toast.success(isExtension ? "Extension approved successfully" : "Leave approved successfully");
      resetApproveForm();
      setOverrideOpen(false);
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
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-all",
        disableNavigation
          ? ""
          : "hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
      )}
      onClick={() => {
        if (disableNavigation || !lr?.id) return;
        router.push(`${detailPrefix.replace(/\/+$/, "")}/${lr.id}`);
      }}
      role={disableNavigation ? undefined : "button"}
      tabIndex={disableNavigation ? undefined : 0}
      onKeyDown={(e) => {
        if (disableNavigation || !lr?.id) return;
        // Only navigate when the card itself has focus — a keypress on an inner
        // control (e.g. Approve/Reject button) must not open the details page.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          router.push(`${detailPrefix.replace(/\/+$/, "")}/${lr.id}`);
        }
      }}
    >
      {/* ── Status color rail ── */}
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: statusColor }}
        aria-hidden
      />

      {/* ── HEADER ── */}
      <div
        className="flex items-center justify-between border-b border-border px-4 py-2.5"
        style={{
          backgroundColor: softTint(leaveColor ?? ""),
          backgroundImage: leaveColor ? topBannerGradient(leaveColor) : undefined,
        }}
      >
        <div className="flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
            isPending
              ? "bg-amber-500/10 text-amber-600"
              : leaveStatus === LEAVE_REQUEST_STATUS.REJECTED || leaveStatus === LEAVE_REQUEST_STATUS.CANCELLED
                ? "bg-red-500/10 text-red-600"
                : leaveStatus === LEAVE_REQUEST_STATUS.EXPIRED || leaveStatus === LEAVE_REQUEST_STATUS.OVERDUE
                  ? "bg-red-500/10 text-red-600"
                  : "bg-emerald-500/10 text-emerald-600",
          )}>
            <span className={cn("h-1.5 w-1.5 rounded-full", isPending ? "bg-amber-500" : leaveStatus === LEAVE_REQUEST_STATUS.REJECTED || leaveStatus === LEAVE_REQUEST_STATUS.CANCELLED || leaveStatus === LEAVE_REQUEST_STATUS.EXPIRED || leaveStatus === LEAVE_REQUEST_STATUS.OVERDUE ? "bg-red-500" : "bg-emerald-500")} />
            {headerBadge}
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
            <LeaveTypeBadge
              name={item.leaveTypeName ?? "Leave"}
              color={(item.leaveTypeUiConfig?.color as string | undefined) ?? null}
            />
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {lr ? `${formatDate(lr.startAt)}→${formatDate(lr.endAt)}` : "—"}
              <span className="ml-0.5 rounded bg-muted px-1 py-0.5 text-[10px] font-medium">
                {lr ? getDurationLabel(lr.startAt, lr.endAt, { short: true }) : ""}
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
          <WorkflowProgress steps={steps} compact />
        </div>

        {/* Right — actions / status */}
        <div className="flex shrink-0 items-center justify-center sm:w-44">
          {isLeavePending && isPending ? (
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
                      setActionError("");
                      setApproveOpen(true);
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
              {leaveStatus === LEAVE_REQUEST_STATUS.REJECTED || leaveStatus === LEAVE_REQUEST_STATUS.CANCELLED ? (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    {leaveStatus === LEAVE_REQUEST_STATUS.CANCELLED
                      ? "Cancelled"
                      : failedStepLabel
                        ? `Rejected by ${failedStepLabel}`
                        : "Rejected"}
                  </span>
                </>
              ) : leaveStatus === LEAVE_REQUEST_STATUS.EXPIRED || leaveStatus === LEAVE_REQUEST_STATUS.OVERDUE ? (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-red-600">
                    {leaveStatus === LEAVE_REQUEST_STATUS.EXPIRED ? "Expired" : "Overdue"}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                    {leaveStatus === LEAVE_REQUEST_STATUS.COMPLETED ? "Completed" : "Approved"}
                  </span>
                </>
              )}
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

      {/* ── Confirm reject ── */}
      {showPreview === "reject" && (
        <AutoPreviewModal
          open
          onOpenChange={() => setShowPreview(null)}
          action="reject"
          studentName={item.studentName ?? "this student"}
          onConfirm={() => {
            setShowPreview(null);
            handleReject();
          }}
          loading={actionLoading}
        />
      )}

      {/* ── Approve dialog ── */}
      <AlertDialog
        open={approveOpen}
        onOpenChange={(open) => {
          setApproveOpen(open);
          if (!open) setActionError("");
        }}
      >
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">
                  {isExtension ? "Approve Extension" : "Approve Leave"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will approve {lr?.requestNumber ?? ""} for {item.studentName ?? "this student"}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Comment <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add a note about your approval..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            {!isPocViewer && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                  CC recipients <span className="text-muted-foreground/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={ccEmailsInput}
                  onChange={(e) => setCcEmailsInput(e.target.value)}
                  placeholder="name@example.com, another@example.com"
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  These addresses will be CC&apos;d on the approval email sent to the student.
                </p>
              </div>
            )}

            <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3">
              {!isPocViewer && (
                <>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyStudent}
                      onChange={(e) => setNotifyStudent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Notify student</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyParent}
                      onChange={(e) => setNotifyParent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-sm">Notify parent</span>
                  </label>
                </>
              )}
              {isSpecialLeave && (
                <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                  <input
                    type="checkbox"
                    checked={documentsVerified}
                    onChange={(e) => setDocumentsVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm">
                    <strong>I confirm that the documents have been verified</strong>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      This leave type requires document verification before approval.
                    </p>
                  </span>
                </label>
              )}
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {actionError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button onClick={submitApprove} disabled={actionLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Parent override confirmation ── */}
      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
                <Clock className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">Parent approval pending</AlertDialogTitle>
                <AlertDialogDescription>
                  Parent approval is still pending for {item.studentName ?? "this student"}. Approving now will
                  override the parent approval process.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {actionError && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {actionError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button
              onClick={submitOverride}
              disabled={actionLoading}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Anyway
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
