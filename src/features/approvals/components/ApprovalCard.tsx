"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  Clock,
  Globe,
  MapPin,
  ShieldAlert,
  TimerOff,
  UserCheck,
} from "lucide-react";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { cn } from "@/lib/utils";

export type ApprovalCardItem = {
  id: string;
  studentName: string | null;
  studentRollNumber: string | null;
  decision: string;
  approverRoleCode: string | null;
  createdAt: string | Date;
  stepKey?: string | null;
  stepOrder?: number | null;
  parentApprovalVerifiedAt?: string | Date | null;
  approverParentId?: string | null;
  isExtension?: boolean;
  leaveRequest: {
    id: string;
    status: string;
    startAt: Date | string;
    endAt: Date | string;
    reason: string;
    requestNumber: string;
  } | null;
};

type ApprovalCardProps = {
  item: ApprovalCardItem;
  isSelected: boolean;
  onClick: () => void;
  isOverdue?: boolean;
  isParentPending?: boolean;
  leaveTypeName?: string;
  destination?: string;
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
    return `${days} day${days > 1 ? "s" : ""}`;
  } catch {
    return "—";
  }
}

function getWaitingTime(createdAt: string | Date): string {
  try {
    const date = typeof createdAt === "string" ? parseISO(createdAt) : createdAt;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "—";
  }
}

export function ApprovalCard({
  item,
  isSelected,
  onClick,
  isOverdue,
  isParentPending,
  leaveTypeName,
  destination,
}: ApprovalCardProps) {
  const lr = item.leaveRequest;
  const isPending = item.decision === LEAVE_APPROVAL_DECISION.PENDING;
  const isApproved = item.decision === LEAVE_APPROVAL_DECISION.APPROVED || item.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED;
  const isRejected = item.decision === LEAVE_APPROVAL_DECISION.REJECTED;
  const isExtension = item.isExtension ?? false;

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
    "bg-cyan-500/10 text-cyan-600",
  ];
  const avatarColor =
    avatarColors[
      Math.abs((item.studentName ?? "").charCodeAt(0) || 0) % avatarColors.length
    ]!;

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

      {/* Top row: status + risk badges */}
      <div className="mb-2.5 flex items-center gap-2 pl-3">
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", statusColor)}>
          <span className={cn("h-1.5 w-1.5 rounded-full", statusDot)} />
          {isPending ? "Pending" : isApproved ? "Approved" : isRejected ? "Rejected" : item.decision}
        </span>

        {isExtension && (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">
            <AlertTriangle className="h-3 w-3" />
            Extension
          </span>
        )}

        {isOverdue && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600">
            <TimerOff className="h-3 w-3" />
            Overdue
          </span>
        )}

        {isParentPending && isPending && (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-600">
            <UserCheck className="h-3 w-3" />
            Parent Pending
          </span>
        )}

        {item.stepKey && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-500/10 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-400">
            <ShieldAlert className="h-3 w-3" />
            {item.stepKey.replace(/_/g, " ")}
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

          {/* Leave type */}
          {leaveTypeName && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
              <span>{leaveTypeName}</span>
            </div>
          )}

          {/* Dates */}
          {lr && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {formatDate(lr.startAt)}
                <ArrowRight className="mx-1 inline h-3 w-3" />
                {formatDate(lr.endAt)}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 font-medium text-foreground/70">
                {getDuration(lr.startAt, lr.endAt)}
              </span>
            </div>
          )}

          {/* Destination */}
          {destination && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{destination}</span>
            </div>
          )}

          {/* Bottom info row */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Waiting {getWaitingTime(item.createdAt)}
            </span>

            {lr && (
              <span className="truncate max-w-[180px]">{lr.reason}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
