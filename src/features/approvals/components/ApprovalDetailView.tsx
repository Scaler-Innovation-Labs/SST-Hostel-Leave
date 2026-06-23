"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Mail,
  Phone,
  User,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

type ApprovalDetailViewProps = {
  leaveId: string;
  onBack: () => void;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function getDuration(startAt: string, endAt: string): string {
  try {
    const start = parseISO(startAt);
    const end = parseISO(endAt);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "Same day";
    return `${days} day${days > 1 ? "s" : ""}`;
  } catch {
    return "—";
  }
}

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr.split("T")[0] ?? "—";
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr ?? "—";
  }
}

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

type ApprovalStep = {
  id: string;
  stepKey: string;
  stepOrder: number;
  decision: string;
  approverRoleCode: string | null;
  approverName?: string;
  comments: string | null;
  createdAt: string;
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
  rejected: {
    icon: XCircle,
    color: "text-red-500",
    bg: "bg-red-500",
    lightBg: "bg-red-500/10",
    border: "border-red-500/30",
    label: "Rejected",
  },
  pending: {
    icon: Clock,
    color: "text-amber-500",
    bg: "bg-amber-500",
    lightBg: "bg-amber-500/10",
    border: "border-amber-500/30",
    label: "Pending",
  },
};

export function ApprovalDetailView({ leaveId, onBack }: ApprovalDetailViewProps) {
  const {
    leave,
    isLoading: leaveLoading,
    isError: leaveError,
    error: leaveErr,
    mutate: leaveMutate,
  } = useLeave(leaveId);
  const {
    approvals,
    isLoading: chainLoading,
    isError: chainError,
    mutate: chainMutate,
  } = useApprovalChain(leaveId);

  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  const isLoading = leaveLoading || chainLoading;
  const isError = leaveError || chainError;

  const [actionError, setActionError] = useState("");

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (actionTarget === "approve") {
        await approveLeave(leaveId, comments || undefined);
      } else {
        await rejectLeave(leaveId, comments || undefined);
      }
      setActionTarget(null);
      setComments("");
      setShowComments(false);
      await Promise.all([leaveMutate(), chainMutate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval detail action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) return <LoadingState count={4} />;
  if (isError) {
    return (
      <ErrorState
        message={leaveErr?.message ?? "Failed to load details"}
        onRetry={() => {
          leaveMutate();
          chainMutate();
        }}
      />
    );
  }
  if (!leave) return <ErrorState message="Leave not found" />;

  const requestNumber = leave.requestNumber ?? leave.id ?? "Leave Detail";
  const status = leave.status.toLowerCase();
  const isPending = status === "pending";
  const leaveTypeName = leave.leaveTypeName ?? "—";
  const startAt = leave.startAt ?? "";
  const endAt = leave.endAt ?? "";
  const expectedReturnAt = leave.expectedReturnAt ?? "";
  const reason = leave.reason ?? "—";
  const studentName = leave.userFullName ?? (`${leave.studentFirstName ?? ""} ${leave.studentLastName ?? ""}`.trim() || "—");
  const rollNumber = leave.studentRollNumber ?? "—";
  const email = leave.userEmail ?? "";
  const phone = leave.userPhone ?? "";
  const createdAt = leave.createdAt ?? "";

  const sortedApprovals = [...approvals]
    .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
    .map((app) => ({
      ...app,
      decision: app.decision.toLowerCase(),
    })) as ApprovalStep[];

  const avatarColors = [
    "bg-blue-500/10 text-blue-600",
    "bg-emerald-500/10 text-emerald-600",
    "bg-violet-500/10 text-violet-600",
    "bg-amber-500/10 text-amber-600",
    "bg-rose-500/10 text-rose-600",
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span className="font-mono text-base">{requestNumber}</span>
            <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
          </div>
        }
        description={
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(startAt)} — {formatDate(endAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {getDuration(startAt, endAt)}
            </span>
          </div>
        }
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Main content — leave info + approval chain */}
        <div className="space-y-6 xl:col-span-2">
          {/* Leave Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Leave Information
            </h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Leave Type
                </dt>
                <dd className="mt-1 font-medium">{leaveTypeName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    status={status as "approved" | "pending" | "rejected" | "active"}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Start Date
                </dt>
                <dd className="mt-1 font-medium">{formatDate(startAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  End Date
                </dt>
                <dd className="mt-1 font-medium">{formatDate(endAt)}</dd>
              </div>
              {expectedReturnAt && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Expected Return
                  </dt>
                  <dd className="mt-1 font-medium">{formatDate(expectedReturnAt)}</dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duration
                </dt>
                <dd className="mt-1 font-medium">{getDuration(startAt, endAt)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reason
                </dt>
                <dd className="mt-1 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                  {reason}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Applied On
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {createdAt ? formatDateTime(createdAt) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Applied
                </dt>
                <dd className="mt-1 text-sm text-muted-foreground">
                  {createdAt ? formatRelative(createdAt) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Approval Timeline */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Approval Chain
            </h3>
            {sortedApprovals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No approvals recorded yet.
                </p>
              </div>
            ) : (
              <div className="relative">
                {sortedApprovals.map((app, i) => {
                  const decision = app.decision as keyof typeof DECISION_CONFIG;
                  const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.pending;
                  const Icon = config.icon;
                  const isLast = i === sortedApprovals.length - 1;
                  const isActive = decision === "pending";
                  const showConnector = !isLast;

                  return (
                    <div key={app.id} className="relative flex gap-4">
                      {/* Timeline dot + connector */}
                      <div className="flex flex-col items-center">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                            isActive
                              ? "border-amber-500 bg-amber-500/10"
                              : decision === "approved"
                              ? "border-emerald-500 bg-emerald-500/10"
                              : decision === "rejected"
                              ? "border-red-500 bg-red-500/10"
                              : "border-border bg-muted",
                          )}
                        >
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              isActive
                                ? "text-amber-500"
                                : decision === "approved"
                                ? "text-emerald-500"
                                : decision === "rejected"
                                ? "text-red-500"
                                : "text-muted-foreground",
                            )}
                          />
                        </div>
                        {showConnector && (
                          <div className="h-full w-px bg-border" />
                        )}
                      </div>

                      {/* Step content */}
                      <div className={cn("min-w-0 flex-1 pb-8", isLast && "pb-0")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold capitalize">
                            {app.stepKey?.replace(/_/g, " ") ?? `Step ${app.stepOrder}`}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                              isActive
                                ? "bg-amber-500/10 text-amber-600"
                                : decision === "approved"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : decision === "rejected"
                                ? "bg-red-500/10 text-red-600"
                                : "bg-muted text-muted-foreground",
                            )}
                          >
                            {config.label}
                          </span>
                        </div>

                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            Role: {app.approverRoleCode ?? "—"}
                          </span>
                          {app.approverName && (
                            <span>· {app.approverName}</span>
                          )}
                          {app.createdAt && (
                            <span>· {formatDateTime(app.createdAt)}</span>
                          )}
                        </div>

                        {app.comments && (
                          <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                            <span className="text-xs font-medium text-muted-foreground">
                              Comments:
                            </span>{" "}
                            {app.comments}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments input for action */}
          {isPending && showComments && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <label className="mb-2 block text-sm font-medium">
                Comments (optional)
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add a note about your decision..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Student Info */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              Student
            </h3>

            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  avatarColors[Math.abs(studentName.charCodeAt(0)) % avatarColors.length],
                )}
              >
                {getInitials(studentName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{studentName}</p>
                <p className="text-xs text-muted-foreground">{rollNumber}</p>
              </div>
            </div>

            <div className="mt-4 space-y-3 border-t border-border pt-4">
              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`mailto:${email}`}
                    className="truncate text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {email}
                  </a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a
                    href={`tel:${phone}`}
                    className="text-muted-foreground hover:text-foreground hover:underline"
                  >
                    {phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {isPending && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Actions
              </h3>

              <div className="space-y-2">
                {!showComments && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComments(true)}
                    className="w-full gap-1 text-xs text-muted-foreground"
                  >
                    <ChevronDown className="h-3 w-3" />
                    Add comments
                  </Button>
                )}
                <Button
                  onClick={() => setActionTarget("approve")}
                  disabled={actionLoading}
                  className="w-full gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setActionTarget("reject")}
                  disabled={actionLoading}
                  className="w-full gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {/* Confirmation Dialogs */}
      <ConfirmationDialog
        open={actionTarget === "approve"}
        onOpenChange={() => setActionTarget(null)}
        title="Approve Leave"
        description={
          comments
            ? `Approve this leave with your comment: "${comments}"`
            : "Are you sure you want to approve this leave request?"
        }
        confirmLabel="Approve"
        onConfirm={handleAction}
        loading={actionLoading}
      />
      <ConfirmationDialog
        open={actionTarget === "reject"}
        onOpenChange={() => setActionTarget(null)}
        title="Reject Leave"
        description={
          comments
            ? `Reject this leave with your comment: "${comments}"`
            : "Are you sure you want to reject this leave request?"
        }
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </div>
  );
}
