"use client";

import { useState } from "react";

import Link from "next/link";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { ArrowRight, Calendar, ChevronRight, Eye } from "lucide-react";

type ApprovalItem = {
  id: string;
  studentName: string | null;
  studentRollNumber: string | null;
  decision: string;
  approverRoleCode: string | null;
  leaveRequest: {
    id: string;
    status: string;
    startAt: Date;
    endAt: Date;
    reason: string;
    requestNumber: string;
  } | null;
};

type ApprovalTableProps = {
  approvals: ApprovalItem[];
  total: number;
  page: number;
  totalPages: number;
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onPageChange: (page: number) => void;
  onMutate: () => void;
  basePath?: string;
};

function getAvatarColor(name: string): string {
  const colors = [
    "bg-blue-500/10 text-blue-600",
    "bg-emerald-500/10 text-emerald-600",
    "bg-violet-500/10 text-violet-600",
    "bg-amber-500/10 text-amber-600",
    "bg-rose-500/10 text-rose-600",
    "bg-cyan-500/10 text-cyan-600",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % colors.length;
  return colors[idx]!;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? parseISO(d) : d;
  return format(date, "MMM d");
}

export function ApprovalTable({
  approvals,
  page,
  totalPages,
  isLoading,
  isError,
  error,
  onPageChange,
  onMutate,
  basePath = "/admin/approvals",
}: ApprovalTableProps) {
  const [actionTarget, setActionTarget] = useState<{
    id: string;
    action: "approve" | "reject";
    studentName: string;
  } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string>("");

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (actionTarget.action === "approve") {
        await approveLeave(actionTarget.id);
      } else {
        await rejectLeave(actionTarget.id);
      }
      setActionTarget(null);
      onMutate();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      console.error("[ApprovalTable] Action failed:", error);
    } finally {
      setActionLoading(false);
    }
  };

  if (isError) {
    return <ErrorState message={error?.message ?? "Failed to load approvals"} onRetry={onMutate} />;
  }

  if (isLoading) {
    return <LoadingState count={5} />;
  }

  if (approvals.length === 0) {
    return <EmptyState title="No approvals" description="No pending approvals to review." />;
  }

  return (
    <>
      <div className="divide-y divide-border rounded-xl border border-border">
        {approvals.map((item) => {
          const lr = item.leaveRequest;
          const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;

          return (
            <div
              key={item.id}
              className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
            >
              {/* Avatar */}
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
                  getAvatarColor(item.studentName ?? item.id),
                )}
              >
                {getInitials(item.studentName ?? "?")}
              </div>

              {/* Main content */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {item.studentName ?? "—"}
                  </span>
                  {item.studentRollNumber && (
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      #{item.studentRollNumber}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {lr && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(lr.startAt)}
                        <ArrowRight className="h-3 w-3" />
                        {formatDate(lr.endAt)}
                      </span>
                      <span className="truncate max-w-[200px]">{lr.reason}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Status + actions */}
              <div className="flex shrink-0 items-center gap-3">
                <StatusBadge
                  status={item.decision.toLowerCase() as "approved" | "pending" | "rejected"}
                />

                <Link
                  href={`${basePath}/${lr?.id ?? item.id}`}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
                >
                  <Eye className="h-4 w-4" />
                </Link>

                {isPending && (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        setActionTarget({
                          id: lr?.id ?? item.id,
                          action: "approve",
                          studentName: item.studentName ?? "this student",
                        })
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        setActionTarget({
                          id: lr?.id ?? item.id,
                          action: "reject",
                          studentName: item.studentName ?? "this student",
                        })
                      }
                    >
                      Reject
                    </Button>
                  </>
                )}

                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {actionError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
          {actionError}
        </div>
      )}

      <ConfirmationDialog
        open={!!actionTarget}
        onOpenChange={() => setActionTarget(null)}
        title={actionTarget?.action === "approve" ? "Approve Leave" : "Reject Leave"}
        description={
          actionTarget?.action === "approve"
            ? `Are you sure you want to approve the leave for ${actionTarget?.studentName}?`
            : `Are you sure you want to reject the leave for ${actionTarget?.studentName}?`
        }
        confirmLabel={actionTarget?.action === "approve" ? "Approve" : "Reject"}
        variant={actionTarget?.action === "approve" ? "default" : "destructive"}
        onConfirm={handleAction}
        loading={actionLoading}
      />
    </>
  );
}
