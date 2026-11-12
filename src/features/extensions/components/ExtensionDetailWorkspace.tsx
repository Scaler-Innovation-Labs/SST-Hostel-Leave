"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  ShieldAlert,
  User,
  XCircle,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { Avatar } from "@/design-system/sst";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import {
  approveExtension,
  overrideExtension,
  resendExtensionParentApproval,
} from "@/lib/api/extension-api";
import { formatDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";

import type { ExtensionCardItem } from "./ExtensionCard";

type ExtensionDetailWorkspaceProps = {
  item: ExtensionCardItem;
  onBack?: () => void;
  onActionComplete?: () => void;
  viewerRole?: "ADMIN" | "SUPER_ADMIN" | "POC" | string;
};

export function ExtensionDetailWorkspace({
  item,
  onBack,
  onActionComplete,
  viewerRole = "ADMIN",
}: ExtensionDetailWorkspaceProps) {
  const ext = item.extension;
  const lr = item.leaveRequest;

  const isPending =
    item.decision === LEAVE_APPROVAL_DECISION.PENDING ||
    ext?.status?.toUpperCase() === "PENDING";
  const isRejected =
    item.decision === LEAVE_APPROVAL_DECISION.REJECTED ||
    ext?.status?.toUpperCase() === "REJECTED";
  const isApproved =
    item.decision === LEAVE_APPROVAL_DECISION.APPROVED ||
    item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED ||
    ext?.status?.toUpperCase() === "APPROVED";

  const canOverride = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";

  // Fetch leave data for student info
  const { leave, isLoading: leaveLoading, mutate: mutateLeave } = useLeave(lr?.id);

  const effectiveLeave =
    leave ??
    (lr?.startAt && lr?.endAt
      ? {
          leaveTypeName: lr.leaveTypeName ?? "—",
          startAt: lr.startAt,
          endAt: lr.endAt,
          reason: lr.reason ?? "—",
        }
      : null);

  // Standard approve / reject state
  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  // Parent override prompt (triggered when standard approve detects pending parent)
  const [parentOverrideOpen, setParentOverrideOpen] = useState(false);

  // Dedicated admin override dialog state
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideMode, setOverrideMode] = useState<"ONE_STEP" | "ALL">("ALL");
  const [overrideComments, setOverrideComments] = useState("");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");

  // Resend parent SMS state
  const [resendingSms, setResendingSms] = useState(false);

  // Calculate day difference
  const diffDays = (() => {
    if (!ext?.currentEndAt || !ext?.requestedEndAt) return null;
    try {
      const orig = new Date(ext.currentEndAt).getTime();
      const req = new Date(ext.requestedEndAt).getTime();
      const diff = Math.round((req - orig) / (1000 * 60 * 60 * 24));
      return Number.isNaN(diff) ? null : diff;
    } catch {
      return null;
    }
  })();

  const handleAction = async (forceOverride = false) => {
    if (!actionTarget || !ext) return;
    setActionLoading(true);
    setActionError("");

    try {
      const result = await approveExtension(ext.id, {
        decision:
          actionTarget === "approve"
            ? LEAVE_APPROVAL_DECISION.APPROVED
            : LEAVE_APPROVAL_DECISION.REJECTED,
        comments: comments || undefined,
        forceOverride,
      });

      if ((result as { requiresConfirmation?: boolean })?.requiresConfirmation) {
        setActionTarget(null);
        setParentOverrideOpen(true);
        return;
      }

      toast.success(
        actionTarget === "approve"
          ? "Extension approved successfully"
          : "Extension rejected"
      );

      setActionTarget(null);
      setParentOverrideOpen(false);
      setComments("");
      setShowComments(false);
      await mutateLeave();
      onActionComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Extension action failed", { error: message });
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const confirmParentOverride = async () => {
    if (!ext) return;
    setActionLoading(true);
    setActionError("");

    try {
      await approveExtension(ext.id, {
        decision: LEAVE_APPROVAL_DECISION.APPROVED,
        comments: comments || undefined,
        forceOverride: true,
      });

      toast.success("Extension approved with parent override");
      setParentOverrideOpen(false);
      setComments("");
      setShowComments(false);
      await mutateLeave();
      onActionComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Parent override failed";
      setActionError(message);
      logger.error("Extension parent override failed", { error: message });
      toast.error(message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOverride = async () => {
    if (!ext) return;
    setOverrideLoading(true);
    setOverrideError("");

    try {
      await overrideExtension(ext.id, overrideMode, overrideComments || undefined);

      toast.success(
        overrideMode === "ALL"
          ? "Extension fully approved and leave end date updated"
          : "Extension advanced to the next approval step"
      );

      setOverrideOpen(false);
      setOverrideComments("");
      await mutateLeave();
      onActionComplete?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Override failed";
      setOverrideError(message);
      logger.error("Extension override failed", { error: message });
      toast.error(message);
    } finally {
      setOverrideLoading(false);
    }
  };

  const handleResendParentSms = async () => {
    if (!ext) return;
    setResendingSms(true);

    try {
      const res = await resendExtensionParentApproval(ext.id);
      toast.success(res.message || "Parent approval SMS resent successfully");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to resend parent approval link";
      logger.error("Resend parent SMS failed", { error: message });
      toast.error(message);
    } finally {
      setResendingSms(false);
    }
  };

  const parentNameDisplay =
    item.parentName || (leave as { parentName?: string } | null)?.parentName || "—";
  const parentPhoneDisplay =
    item.parentPhone || (leave as { parentPhone?: string } | null)?.parentPhone || "—";

  return (
    <div className="space-y-5">
      {/* Back button on mobile */}
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="mb-2 flex items-center gap-1.5 text-body text-muted hover:text-ink xl:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to queue
        </button>
      )}

      {/* Rejection Alert Banner with Recovery Override */}
      {isRejected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl border border-danger/40 bg-danger-light p-4 text-danger">
          <div className="flex items-start gap-3">
            <XCircle className="h-5 w-5 mt-0.5 shrink-0 text-danger" />
            <div>
              <p className="font-semibold text-body">This extension request is currently REJECTED</p>
              <p className="text-caption mt-0.5 opacity-90">
                The original return deadline remains in effect. As an administrator, you can override and approve this request if it was rejected in error.
              </p>
            </div>
          </div>
          {canOverride && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setOverrideMode("ALL");
                setOverrideOpen(true);
              }}
              className="shrink-0 bg-danger text-white hover:bg-danger/90 gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              Override & Approve
            </Button>
          )}
        </div>
      )}

      {/* Student Info Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-4 flex items-center gap-2 text-body font-semibold">
          <User className="h-4 w-4 text-muted" />
          Student Details
        </h4>
        <div className="flex items-center gap-4">
          <Avatar name={item.studentName} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 font-semibold">{item.studentName ?? "—"}</h3>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted font-mono text-caption">
              <span>{item.studentRollNumber ?? "—"}</span>
              {item.studentGender && <span>• {item.studentGender}</span>}
              {item.departmentName && <span>• {item.departmentName}</span>}
            </div>
          </div>
          <StatusBadge
            status={
              isApproved
                ? "approved"
                : isRejected
                ? "rejected"
                : "pending"
            }
          />
        </div>

        {(item.hostelName || item.roomNumber || leave?.userEmail || leave?.userPhone) && (
          <div className="mt-4 grid gap-y-2 border-t border-border pt-4 sm:grid-cols-2 text-body text-muted">
            {(item.hostelName || item.roomNumber) && (
              <div className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {item.hostelName || "Hostel"} — Room {item.roomNumber || "N/A"}
                </span>
              </div>
            )}
            {leave?.userEmail && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{leave.userEmail}</span>
              </div>
            )}
            {leave?.userPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                <span>{leave.userPhone}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extension Details Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="flex items-center gap-2 text-body font-semibold">
            <FileText className="h-4 w-4 text-muted" />
            Extension Details
          </h4>
          {lr?.id && (
            <Link
              href={`/admin/leave-approvals/${lr.id}`}
              className="text-caption text-primary hover:underline flex items-center gap-1"
            >
              View Base Leave
              <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        {ext ? (
          <div className="space-y-4">
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <div>
                <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                  Extension #
                </dt>
                <dd className="mt-0.5 text-body font-medium">#{ext.extensionNumber}</dd>
              </div>
              <div>
                <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                  Status
                </dt>
                <dd className="mt-0.5">
                  <StatusBadge
                    status={
                      ext.status?.toLowerCase() as
                        | "approved"
                        | "pending"
                        | "rejected"
                        | "active"
                    }
                  />
                </dd>
              </div>
            </div>

            {/* Visual date transition */}
            <div className="rounded-lg border border-border bg-surface-sunken p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-caption font-medium uppercase tracking-wider text-muted block">
                  Current End Date
                </span>
                <span className="text-body font-medium flex items-center gap-1.5 mt-1">
                  <Calendar className="h-4 w-4 text-muted" />
                  {formatDate(ext.currentEndAt)}
                </span>
              </div>

              <div className="hidden sm:flex text-muted">
                <ArrowRight className="h-5 w-5" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="text-caption font-medium uppercase tracking-wider text-primary font-semibold block">
                    Requested New End Date
                  </span>
                  {diffDays !== null && (
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 text-caption font-semibold text-accent">
                      +{diffDays} day{diffDays === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
                <span className="text-body font-semibold text-primary flex items-center gap-1.5 mt-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  {formatDate(ext.requestedEndAt)}
                </span>
              </div>
            </div>

            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Reason for Extension
              </dt>
              <dd className="mt-1 rounded-lg border border-border bg-bg p-3 text-body whitespace-pre-wrap">
                {ext.reason || "—"}
              </dd>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted">Extension details not available.</p>
        )}
      </div>

      {/* Parent / Guardian Information Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="flex items-center gap-2 text-body font-semibold">
            <Phone className="h-4 w-4 text-muted" />
            Parent / Guardian Details
          </h4>
          {canOverride && ext && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleResendParentSms}
              disabled={resendingSms}
              className="gap-1.5 text-caption h-8"
            >
              {resendingSms ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 text-primary" />
                  Resend Parent SMS
                </>
              )}
            </Button>
          )}
        </div>

        <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2 text-body">
          <div>
            <dt className="text-caption font-medium uppercase tracking-wider text-muted">
              Parent Name
            </dt>
            <dd className="mt-0.5 font-medium">{parentNameDisplay}</dd>
          </div>
          <div>
            <dt className="text-caption font-medium uppercase tracking-wider text-muted">
              Parent Contact
            </dt>
            <dd className="mt-0.5 font-mono font-medium">{parentPhoneDisplay}</dd>
          </div>
        </div>
      </div>

      {/* Original Leave Request Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-4 flex items-center gap-2 text-body font-semibold">
          <Globe className="h-4 w-4 text-muted" />
          Base Leave Details
        </h4>
        {leaveLoading && !effectiveLeave ? (
          <LoadingState count={1} />
        ) : effectiveLeave ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Leave Type
              </dt>
              <dd className="mt-0.5 text-body font-medium">{effectiveLeave.leaveTypeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Original Duration
              </dt>
              <dd className="mt-0.5 text-body text-muted">
                {formatDate(effectiveLeave.startAt)} — {formatDate(effectiveLeave.endAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Original Reason
              </dt>
              <dd className="mt-0.5 text-body text-muted">{effectiveLeave.reason ?? "—"}</dd>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted">Leave details not available.</p>
        )}
      </div>

      {/* Action Decision Card */}
      {(isPending || canOverride) && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-body font-semibold">
              <MessageSquare className="h-4 w-4 text-muted" />
              Administrative Actions
            </h4>
            {isPending && !showComments && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(true)}
                className="gap-1 text-caption text-muted"
              >
                <ChevronDown className="h-3 w-3" />
                Add comment
              </Button>
            )}
          </div>

          {isPending && showComments && (
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add a note about your decision..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-bg p-3 text-body outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
            />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {isPending && (
              <>
                <Button
                  onClick={() => setActionTarget("approve")}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Extension
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setActionTarget("reject")}
                  disabled={actionLoading}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject Extension
                </Button>
              </>
            )}

            {/* Override action for ADMIN / SUPER_ADMIN */}
            {canOverride && (
              <Button
                variant="outline"
                onClick={() => setOverrideOpen(true)}
                disabled={actionLoading || overrideLoading}
                className="gap-1.5 border-warning/50 text-warning hover:bg-warning-light"
              >
                <ShieldAlert className="h-4 w-4 text-warning" />
                {isRejected ? "Override Rejection..." : "Override Extension..."}
              </Button>
            )}
          </div>

          {actionError && (
            <div className="mt-3 rounded-lg bg-danger-light p-3 text-body text-danger">
              {actionError}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialog for Standard Approve */}
      <ConfirmationDialog
        open={actionTarget === "approve"}
        onOpenChange={() => setActionTarget(null)}
        title="Approve this extension?"
        consequence={
          comments
            ? `The student's return deadline moves to ${
                ext ? formatDate(ext.requestedEndAt) : "the requested date"
              }. Your comment is recorded: "${comments}"`
            : `The student's return deadline moves to ${
                ext ? formatDate(ext.requestedEndAt) : "the requested date"
              } and they are notified.`
        }
        confirmLabel="Approve extension"
        dismissLabel="Go back"
        destructive={false}
        onConfirm={() => handleAction(false)}
        loading={actionLoading}
      />

      {/* Confirmation Dialog for Standard Reject */}
      <ConfirmationDialog
        open={actionTarget === "reject"}
        onOpenChange={() => setActionTarget(null)}
        title="Reject this extension?"
        consequence={
          comments
            ? `The student keeps their original return deadline. Your reason is recorded: "${comments}"`
            : "The student keeps their original return deadline and is notified. Adding a comment helps them understand why."
        }
        confirmLabel="Reject extension"
        dismissLabel="Go back"
        onConfirm={() => handleAction(false)}
        loading={actionLoading}
      />

      {/* ════════════ PARENT OVERRIDE PROMPT DIALOG ════════════ */}
      <AlertDialog open={parentOverrideOpen} onOpenChange={setParentOverrideOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Parent Approval Pending</AlertDialogTitle>
                <AlertDialogDescription>
                  Parent approval has not yet been received for {item.studentName}. Approving now will administratively override the parent approval step.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {actionError && (
            <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
              {actionError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button
              onClick={confirmParentOverride}
              disabled={actionLoading}
              className="gap-2 bg-warning hover:bg-warning text-white"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  Override & Approve
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════ DEDICATED ADMIN OVERRIDE DIALOG ════════════ */}
      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Administrative Override</AlertDialogTitle>
                <AlertDialogDescription>
                  {isRejected
                    ? "Reverse the rejection and approve this extension request."
                    : "Force-advance or finalize this extension request."}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            {!isRejected && (
              <div>
                <label className="mb-1.5 block text-body font-medium text-muted">
                  Override Mode
                </label>
                <Select
                  value={overrideMode}
                  onValueChange={(v) => setOverrideMode(v as "ONE_STEP" | "ALL")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Approve All (Finalize Extension)</SelectItem>
                    <SelectItem value="ONE_STEP">Advance One Step (Bypass Current)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1.5 text-caption text-muted">
                  {overrideMode === "ALL"
                    ? `Bypasses all pending steps and extends the leave end date to ${
                        ext ? formatDate(ext.requestedEndAt) : "requested date"
                      }.`
                    : "Approves the current pending step (e.g. Parent Approval) and continues the approval chain."}
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Audit Reason / Comment <span className="text-muted/50">(optional)</span>
              </label>
              <textarea
                value={overrideComments}
                onChange={(e) => setOverrideComments(e.target.value)}
                placeholder="e.g. Verbal confirmation from parent over phone..."
                rows={2}
                className="w-full rounded-lg border border-border bg-bg p-3 text-body outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent"
              />
            </div>

            {overrideError && (
              <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
                {overrideError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={overrideLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="default"
              onClick={handleOverride}
              disabled={overrideLoading}
              className="gap-2 bg-warning hover:bg-warning text-white"
            >
              {overrideLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {isRejected || overrideMode === "ALL" ? "Approve All" : "Advance One Step"}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
