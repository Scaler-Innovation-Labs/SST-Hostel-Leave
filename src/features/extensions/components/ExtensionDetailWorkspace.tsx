"use client";

import { format, parseISO } from "date-fns";
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
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { approveExtension } from "@/lib/api/extension-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import type { ExtensionCardItem } from "./ExtensionCard";

type ExtensionDetailWorkspaceProps = {
  item: ExtensionCardItem;
  onBack: () => void;
  onActionComplete: () => void;
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(d: Date | string): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d, yyyy");
  } catch {
    return "—";
  }
}

const avatarColors = [
  "bg-blue-500/10 text-blue-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-amber-500/10 text-amber-600",
  "bg-rose-500/10 text-rose-600",
];

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
        className="mb-2 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground xl:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to queue
      </button>

      {/* Student Info Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          Student
        </h4>
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold",
              avatarColors[Math.abs((item.studentName ?? "").charCodeAt(0) || 0) % avatarColors.length],
            )}
          >
            {getInitials(item.studentName ?? "?")}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold">{item.studentName ?? "—"}</h3>
            <p className="font-mono text-sm text-muted-foreground">
              {item.studentRollNumber ?? "—"}
            </p>
          </div>
          <StatusBadge
            status={item.decision.toLowerCase() as "approved" | "pending" | "rejected"}
          />
        </div>

        {leave && (
          <div className="mt-4 border-t border-border pt-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              {leave.userEmail ?? "—"}
            </div>
            {leave.userPhone && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {leave.userPhone}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Extension Details Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4 text-muted-foreground" />
          Extension Details
        </h4>

        {ext ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Extension #
              </dt>
              <dd className="mt-0.5 text-sm font-medium">#{ext.extensionNumber}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Status
              </dt>
              <dd className="mt-0.5">
                <StatusBadge
                  status={ext.status.toLowerCase() as "approved" | "pending" | "rejected" | "active"}
                />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Current End Date
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {formatDate(ext.currentEndAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Requested New End
              </dt>
              <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                {formatDate(ext.requestedEndAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reason
              </dt>
              <dd className="mt-0.5 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                {ext.reason ?? "—"}
              </dd>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Extension details not available.</p>
        )}
      </div>

      {/* Parent Leave Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4 text-muted-foreground" />
          Parent Leave
        </h4>
        {leaveLoading ? (
          <LoadingState count={1} />
        ) : leave ? (
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Leave Type
              </dt>
              <dd className="mt-0.5 text-sm font-medium">{leave.leaveTypeName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Duration
              </dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">
                {formatDate(leave.startAt)} — {formatDate(leave.endAt)}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Reason
              </dt>
              <dd className="mt-0.5 text-sm text-muted-foreground">{leave.reason ?? "—"}</dd>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Leave details not available.</p>
        )}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <h4 className="flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Decision
            </h4>
            {!showComments && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowComments(true)}
                className="gap-1 text-xs text-muted-foreground"
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
              className="mt-3 w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
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
            <div className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
              {actionError}
            </div>
          )}
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={actionTarget === "approve"}
        onOpenChange={() => setActionTarget(null)}
        title="Approve Extension"
        description={
          comments
            ? `Approve this extension with your comment: "${comments}"`
            : "Are you sure you want to approve this extension request?"
        }
        confirmLabel="Approve Extension"
        onConfirm={handleAction}
        loading={actionLoading}
      />
      <ConfirmationDialog
        open={actionTarget === "reject"}
        onOpenChange={() => setActionTarget(null)}
        title="Reject Extension"
        description={
          comments
            ? `Reject this extension with your comment: "${comments}"`
            : "Are you sure you want to reject this extension request?"
        }
        confirmLabel="Reject Extension"
        variant="destructive"
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </div>
  );
}
