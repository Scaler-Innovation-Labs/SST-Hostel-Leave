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
    ? "bg-warning-light text-warning border-warning/50"
    : isApproved
    ? "bg-success-light text-success border-success/50"
    : isRejected
    ? "bg-danger-light text-danger border-danger/50"
    : "bg-surface-sunken text-muted border-border";

  const statusDot = isPending
    ? "bg-warning"
    : isApproved
    ? "bg-success"
    : isRejected
    ? "bg-danger"
    : "bg-muted";

  const initials = (item.studentName ?? "?")
    .split(" ")
    .map((n) => n[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const avatarColors = [
    "bg-accent-light text-accent",
    "bg-success-light text-success",
    "bg-accent-light text-accent",
    "bg-warning-light text-warning",
    "bg-danger-light text-danger",
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
          : "border-border bg-card hover:border-muted/30 hover:shadow-sm",
      )}
    >
      {/* Status indicator bar */}
      <div
        className={cn(
          "absolute left-0 top-2 bottom-2 w-1 rounded-full transition-colors",
          isPending ? "bg-warning" : isApproved ? "bg-success" : isRejected ? "bg-danger" : "bg-muted/30",
        )}
      />

      {/* Top row */}
      <div className="mb-2.5 flex items-center gap-2 pl-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-micro font-medium", statusColor)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          {isPending ? "Pending" : isApproved ? "Approved" : isRejected ? "Rejected" : item.decision}
        </span>

        {ext && (
          <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2 py-0.5 text-micro font-medium text-accent">
            <FileText className="h-3 w-3" />
            Extension #{ext.extensionNumber}
          </span>
        )}

        {item.leaveRequest?.requestNumber && (
          <span className="font-mono text-micro text-muted">
            {item.leaveRequest.requestNumber}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex items-start gap-3 pl-3">
        {/* Avatar */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-caption font-semibold",
            avatarColor,
          )}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          {/* Name + Roll */}
          <div className="flex items-center gap-2">
            <span className="truncate text-body font-semibold">
              {item.studentName ?? "—"}
            </span>
            {item.studentRollNumber && (
              <span className="shrink-0 font-mono text-micro text-muted">
                #{item.studentRollNumber}
              </span>
            )}
          </div>

          {/* Dates */}
          {ext && (
            <div className="flex items-center gap-2 text-caption text-muted">
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
            <p className="line-clamp-1 text-caption text-muted">
              {ext.reason}
            </p>
          )}

          {/* Waiting time */}
          {item.createdAt && (
            <div className="flex items-center gap-1.5 pt-1 text-micro text-muted">
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
