"use client";

import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  FileText,
  Globe,
  Mail,
  MessageSquare,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { Avatar } from "@/design-system/sst";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { approveExtension } from "@/lib/api/extension-api";
import { formatDate } from "@/lib/date-utils";
import { logger } from "@/lib/logger";

import type { ExtensionCardItem } from "./ExtensionCard";

type ExtensionDetailWorkspaceProps = {
  item: ExtensionCardItem;
  onBack: () => void;
  onActionComplete: () => void;
};




export function ExtensionDetailWorkspace({
  item,
  onBack,
  onActionComplete,
}: ExtensionDetailWorkspaceProps) {
  const ext = item.extension;
  const lr = item.leaveRequest;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;

  // Fetch leave data for student info
  const { leave, isLoading: leaveLoading } = useLeave(lr?.id);

  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  const handleAction = async () => {
    if (!actionTarget || !ext) return;
    setActionLoading(true);
    setActionError("");
    try {
      await approveExtension(ext.id, {
        decision: actionTarget === "approve" ? LEAVE_APPROVAL_DECISION.APPROVED : LEAVE_APPROVAL_DECISION.REJECTED,
        comments: comments || undefined,
      });
      setActionTarget(null);
      setComments("");
      setShowComments(false);
      onActionComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Extension action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Back button on mobile */}
      <button
        type="button"
        onClick={onBack}
        className="mb-2 flex items-center gap-1.5 text-body text-muted hover:text-ink xl:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to queue
      </button>

      {/* Student Info Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-4 flex items-center gap-2 text-body font-semibold">
          <User className="h-4 w-4 text-muted" />
          Student
        </h4>
        <div className="flex items-center gap-4">
          <Avatar name={item.studentName} size="lg" />
          <div className="min-w-0 flex-1">
            <h3 className="text-h3 font-semibold">{item.studentName ?? "—"}</h3>
            <p className="font-mono text-body text-muted">
              {item.studentRollNumber ?? "—"}
            </p>
          </div>
          <StatusBadge
            status={item.decision.toLowerCase() as "approved" | "pending" | "rejected"}
          />
        </div>

        {leave && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-1.5 text-body text-muted">
              <Mail className="h-3.5 w-3.5" />
              {leave.userEmail ?? "—"}
            </div>
            {leave.userPhone && (
              <div className="mt-1 flex items-center gap-1.5 text-body text-muted">
                <Phone className="h-3.5 w-3.5" />
                {leave.userPhone}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extension Details Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-4 flex items-center gap-2 text-body font-semibold">
          <FileText className="h-4 w-4 text-muted" />
          Extension Details
        </h4>

        {ext ? (
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
                  status={ext.status.toLowerCase() as "approved" | "pending" | "rejected" | "active"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Current End Date
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-body">
                <Calendar className="h-3.5 w-3.5 text-muted" />
                {formatDate(ext.currentEndAt)}
              </dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Requested New End
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-body font-medium text-ink">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                {formatDate(ext.requestedEndAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Reason
              </dt>
              <dd className="mt-0.5 rounded-lg bg-surface-sunken/50 p-3 text-body leading-relaxed">
                {ext.reason ?? "—"}
              </dd>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted">Extension details not available.</p>
        )}
      </div>

      {/* Parent Leave Card */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h4 className="mb-4 flex items-center gap-2 text-body font-semibold">
          <Globe className="h-4 w-4 text-muted" />
          Parent Leave
        </h4>
        {leaveLoading ? (
          <LoadingState count={1} />
        ) : leave ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Leave Type
              </dt>
              <dd className="mt-0.5 text-body font-medium">{leave.leaveTypeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Duration
              </dt>
              <dd className="mt-0.5 text-body text-muted">
                {formatDate(leave.startAt)} — {formatDate(leave.endAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-caption font-medium uppercase tracking-wider text-muted">
                Reason
              </dt>
              <dd className="mt-0.5 text-body text-muted">{leave.reason ?? "—"}</dd>
            </div>
          </div>
        ) : (
          <p className="text-body text-muted">Leave details not available.</p>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-body font-semibold">
              <MessageSquare className="h-4 w-4 text-muted" />
              Decision
            </h4>
            {!showComments && (
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

          {showComments && (
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="Add a note about your decision..."
              rows={3}
              className="mt-3 w-full rounded-lg border border-border bg-bg p-3 text-body outline-none transition-colors focus:border-accent focus:ring-1 focus:ring-accent"
            />
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
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
          </div>

          {actionError && (
            <div className="mt-3 rounded-lg bg-danger-light p-3 text-body text-danger">
              {actionError}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={actionTarget === "approve"}
        onOpenChange={() => setActionTarget(null)}
        title="Approve this extension?"
        consequence={
          comments
            ? `The student's return deadline moves to the requested date and they are notified. Your comment is recorded: "${comments}"`
            : "The student's return deadline moves to the requested date and they are notified."
        }
        confirmLabel="Approve extension"
        dismissLabel="Go back"
        destructive={false}
        onConfirm={handleAction}
        loading={actionLoading}
      />
      <ConfirmationDialog
        open={actionTarget === "reject"}
        onOpenChange={() => setActionTarget(null)}
        title="Reject this extension?"
        consequence={
          comments
            ? `The student keeps their original return deadline and is notified. Your reason is recorded: "${comments}"`
            : "The student keeps their original return deadline and is notified. Adding a reason first helps them understand the decision."
        }
        confirmLabel="Reject extension"
        dismissLabel="Go back"
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </div>
  );
}
