"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import { ArrowRight, Calendar, Clock, FileText } from "lucide-react";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { cn } from "@/lib/utils";

export type ExtensionCardItem = {
  id: string;
  decision: string;
  approverRoleCode: string | null;
  studentName: string | null;
  studentRollNumber: string | null;
  createdAt?: string | Date;
  extension: {
    id: string;
    extensionNumber: number;
    reason: string;
    status: string;
    requestedEndAt: Date | string;
    currentEndAt: Date | string;
  } | null;
  leaveRequest: {
    id: string;
    status: string;
    requestNumber: string;
  } | null;
};

type ExtensionCardProps = {
  item: ExtensionCardItem;
  isSelected: boolean;
  onClick: () => void;
};

function formatDate(d: Date | string): string {
  try {
    const date = typeof d === "string" ? parseISO(d) : d;
    return format(date, "MMM d");
  } catch {
    return "—";
  }
}

export function ExtensionCard({ item, isSelected, onClick }: ExtensionCardProps) {
  const ext = item.extension;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;
  const isApproved = item.decision === LEAVE_APPROVAL_DECISION.APPROVED || item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED;
  const isRejected = item.decision === LEAVE_APPROVAL_DECISION.REJECTED;

  const statusColor = isPending
    ? "bg-amber-500/10 text-amber-600 border-amber-200/50"
    : isApproved
    ? "bg-emerald-500/10 text-emerald-600 border-emerald-200/50"
    : isRejected
    ? "bg-red-500/10 text-red-600 border-red-200/50"
    : "bg-muted text-muted-foreground border-border";

  const statusDot = isPending
    ? "bg-amber-500"
    : isApproved
    ? "bg-emerald-500"
    : isRejected
    ? "bg-red-500"
    : "bg-muted-foreground";

  const initials = (item.studentName ?? "?")
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarColors = [
    "bg-blue-500/10 text-blue-600",
    "bg-emerald-500/10 text-emerald-600",
    "bg-violet-500/10 text-violet-600",
    "bg-amber-500/10 text-amber-600",
    "bg-rose-500/10 text-rose-600",
  ];
  const avatarColor =
    avatarColors[Math.abs((item.studentName ?? "").charCodeAt(0) || 0) % avatarColors.length]!;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full rounded-xl border p-4 text-left transition-all duration-200",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border bg-card hover:border-muted-foreground/30 hover:shadow-sm",
      )}
    >
      {/* Status indicator bar */}
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 rounded-full transition-colors",
          isPending ? "bg-amber-400" : isApproved ? "bg-emerald-400" : isRejected ? "bg-red-400" : "bg-muted-foreground/30",
        )}
      />

      {/* Top row */}
      <div className="mb-2.5 flex items-center gap-2 pl-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", statusColor)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          {isPending ? "Pending" : isApproved ? "Approved" : isRejected ? "Rejected" : item.decision}
        </span>

        {ext && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">
            <FileText className="h-3 w-3" />
            Extension #{ext.extensionNumber}
          </span>
        )}

        {item.leaveRequest?.requestNumber && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {item.leaveRequest.requestNumber}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 pl-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
            avatarColor,
          )}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Name + Roll */}
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

          {/* Dates */}
          {ext && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                Current: {formatDate(ext.currentEndAt)}
              </span>
              <ArrowRight className="h-3 w-3" />
              <span className="font-medium text-foreground/70">
                New: {formatDate(ext.requestedEndAt)}
              </span>
            </div>
          )}

          {/* Reason */}
          {ext?.reason && (
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {ext.reason}
            </p>
          )}

          {/* Waiting time */}
          {item.createdAt && (
            <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>
                Waiting{" "}
                {(() => {
                  try {
                    const date = typeof item.createdAt === "string" ? parseISO(item.createdAt) : item.createdAt;
                    return formatDistanceToNow(date, { addSuffix: true });
                  } catch {
                    return "—";
                  }
                })()}
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
