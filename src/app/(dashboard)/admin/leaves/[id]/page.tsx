"use client";

import { format, parseISO } from "date-fns";
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
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { cn } from "@/lib/utils";

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
    return dateStr?.split("T")[0] ?? "—";
  }
}

function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr ?? "—";
  }
}

const TIMELINE_STEPS = [
  { key: "submitted", label: "Submitted", icon: FileText },
  { key: "parent_approved", label: "Parent Approved", icon: CheckCircle2 },
  { key: "poc_approved", label: "POC Approved", icon: CheckCircle2 },
  { key: "warden_approved", label: "Warden Approved", icon: CheckCircle2 },
  { key: "qr_generated", label: "QR Generated", icon: CheckCircle2 },
  { key: "exited", label: "Exited Hostel", icon: ArrowLeft },
  { key: "returned", label: "Returned", icon: CheckCircle2 },
  { key: "completed", label: "Completed", icon: CheckCircle2 },
] as const;

export default function AdminLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { leave, isLoading, isError, error, mutate } = useLeave(id);
  const { approvals, isLoading: chainLoading } = useApprovalChain(id);
  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [comments, setComments] = useState("");
  const [showComments, setShowComments] = useState(false);

  const loading = isLoading || chainLoading;

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    try {
      if (actionTarget === "approve") {
        await approveLeave(id, comments || undefined);
        toast.success("Leave approved");
      } else {
        await rejectLeave(id, comments || undefined);
        toast.success("Leave rejected");
      }
      setActionTarget(null);
      setComments("");
      setShowComments(false);
      await mutate();
    } catch {
      toast.error(`Failed to ${actionTarget} leave`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message={error?.message ?? "Leave not found"} onRetry={() => mutate()} />;
  if (!leave) return <ErrorState message="Leave not found" />;

  const requestNumber = leave.requestNumber ?? leave.id ?? "—";
  const status = leave.status.toLowerCase();
  const isPending = status === "pending";
  const leaveTypeName = leave.leaveTypeName ?? "—";
  const startAt = leave.startAt ?? "";
  const endAt = leave.endAt ?? "";
  const reason = leave.reason ?? "—";
  const studentName = leave.userFullName ?? (`${leave.studentFirstName ?? ""} ${leave.studentLastName ?? ""}`.trim() || "—");
  const rollNumber = leave.studentRollNumber ?? "—";
  const email = leave.userEmail ?? "";
  const phone = leave.userPhone ?? "";
  const createdAt = leave.createdAt ?? "";
  const isApproved = status === "approved";
  const isRejected = status === "rejected";

  // Determine timeline progress from status
  const timelineProgress = isRejected ? "rejected" : isApproved ? "approved" : status;

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
            <Button variant="outline" onClick={() => router.push("/admin/approvals")} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Main content */}
        <div className="space-y-6 xl:col-span-2">
          {/* Leave Information */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Leave Information
            </h3>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Leave Type</dt>
                <dd className="mt-1 font-medium">{leaveTypeName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</dt>
                <dd className="mt-1">
                  <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Start Date</dt>
                <dd className="mt-1 font-medium">{formatDate(startAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">End Date</dt>
                <dd className="mt-1 font-medium">{formatDate(endAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Duration</dt>
                <dd className="mt-1 font-medium">{getDuration(startAt, endAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Applied On</dt>
                <dd className="mt-1 font-medium">{createdAt ? formatDate(createdAt) : "—"}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</dt>
                <dd className="mt-1 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">{reason}</dd>
              </div>
            </dl>
          </div>

          {/* Timeline */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Timeline
            </h3>
            <div className="relative">
              {TIMELINE_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isRejectedStep = timelineProgress === "rejected" && step.key === "parent_approved";
                const isCompleted = isApproved && i <= TIMELINE_STEPS.findIndex((s) => s.key === timelineProgress);
                const showConnector = i < TIMELINE_STEPS.length - 1;

                return (
                  <div key={step.key} className="relative flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                          isRejectedStep
                            ? "border-red-500 bg-red-500/10"
                            : isCompleted
                            ? "border-emerald-500 bg-emerald-500/10"
                            : "border-border bg-muted",
                        )}
                      >
                        <StepIcon
                          className={cn(
                            "h-4 w-4",
                            isRejectedStep
                              ? "text-red-500"
                              : isCompleted
                              ? "text-emerald-500"
                              : "text-muted-foreground",
                          )}
                        />
                      </div>
                      {showConnector && <div className="h-full w-px bg-border" />}
                    </div>
                    <div className={cn("min-w-0 flex-1 pb-8", i === TIMELINE_STEPS.length - 1 && "pb-0")}>
                      <span
                        className={cn(
                          "text-sm font-semibold",
                          isRejectedStep
                            ? "text-red-500"
                            : isCompleted
                            ? "text-foreground"
                            : "text-muted-foreground",
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Approval Chain */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
              Approval Chain
            </h3>
            {approvals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No approvals recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {approvals
                  .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
                  .map((app) => {
                    const decision = app.decision.toLowerCase();
                    const isApprovedDecision = decision === "approved";
                    const isRejectedDecision = decision === "rejected";
                    return (
                      <div key={app.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                            isApprovedDecision
                              ? "bg-emerald-500/10"
                              : isRejectedDecision
                              ? "bg-red-500/10"
                              : "bg-amber-500/10",
                          )}
                        >
                          {isApprovedDecision ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          ) : isRejectedDecision ? (
                            <XCircle className="h-4 w-4 text-red-500" />
                          ) : (
                            <Clock className="h-4 w-4 text-amber-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium capitalize">
                              {app.stepKey?.replace(/_/g, " ") ?? `Step ${app.stepOrder}`}
                            </span>
                            <span
                              className={cn(
                                "text-[11px] font-medium",
                                isApprovedDecision && "text-emerald-500",
                                isRejectedDecision && "text-red-500",
                                !isApprovedDecision && !isRejectedDecision && "text-amber-500",
                              )}
                            >
                              {decision}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            Role: {app.approverRoleCode ?? "—"}
                            {app.createdAt && ` · ${formatDateTime(app.createdAt)}`}
                          </p>
                          {app.comments && (
                            <p className="mt-1 text-xs text-muted-foreground">Note: {app.comments}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Student Info */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
              <User className="h-4 w-4 text-muted-foreground" />
              Student
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
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
                  <a href={`mailto:${email}`} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                    {email}
                  </a>
                </div>
              )}
              {phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <a href={`tel:${phone}`} className="text-muted-foreground hover:text-foreground hover:underline">
                    {phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          {isPending && (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Actions
              </h3>
              <div className="space-y-2">
                {!showComments && (
                  <Button variant="ghost" size="sm" onClick={() => setShowComments(true)} className="w-full gap-1 text-xs text-muted-foreground">
                    <ChevronDown className="h-3 w-3" />
                    Add comments
                  </Button>
                )}
                {showComments && (
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Add a note about your decision..."
                    rows={3}
                    className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring"
                  />
                )}
                <Button onClick={() => setActionTarget("approve")} disabled={actionLoading} className="w-full gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button variant="destructive" onClick={() => setActionTarget("reject")} disabled={actionLoading} className="w-full gap-2">
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmationDialog
        open={actionTarget === "approve"}
        onOpenChange={() => setActionTarget(null)}
        title="Approve Leave"
        description={comments ? `Approve this leave with your comment: "${comments}"` : "Are you sure you want to approve this leave request?"}
        confirmLabel="Approve"
        onConfirm={handleAction}
        loading={actionLoading}
      />
      <ConfirmationDialog
        open={actionTarget === "reject"}
        onOpenChange={() => setActionTarget(null)}
        title="Reject Leave"
        description={comments ? `Reject this leave with your comment: "${comments}"` : "Are you sure you want to reject this leave request?"}
        confirmLabel="Reject"
        variant="destructive"
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </div>
  );
}
