"use client";

import { format } from "date-fns";
import {
  CheckCircle2,
  Clock,
  FileText,
  Mail,
  MessageSquare,
  Shield,
  UserCheck,
  XCircle,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ActivityEvent = {
  id: string;
  type: "submitted" | "policy_passed" | "workflow_created" | "parent_sms" | "parent_approved" | "parent_rejected" | "approved" | "rejected" | "comment" | "notification" | "escalated" | "forwarded";
  label: string;
  description?: string;
  timestamp: string | Date;
  actor?: string;
};

type ActivityTimelineProps = {
  events: ActivityEvent[];
  className?: string;
};

const EVENT_CONFIG = {
  submitted: { icon: FileText, color: "text-blue-500", bg: "bg-blue-500" },
  policy_passed: { icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500" },
  workflow_created: { icon: FileText, color: "text-violet-500", bg: "bg-violet-500" },
  parent_sms: { icon: Mail, color: "text-violet-500", bg: "bg-violet-500" },
  parent_approved: { icon: UserCheck, color: "text-emerald-500", bg: "bg-emerald-500" },
  parent_rejected: { icon: UserCheck, color: "text-red-500", bg: "bg-red-500" },
  approved: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-500" },
  comment: { icon: MessageSquare, color: "text-blue-500", bg: "bg-blue-500" },
  notification: { icon: Mail, color: "text-gray-500", bg: "bg-gray-500" },
  escalated: { icon: Clock, color: "text-amber-500", bg: "bg-amber-500" },
  forwarded: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500" },
};

function formatTimestamp(ts: string | Date): string {
  try {
    const date = typeof ts === "string" ? new Date(ts) : ts;
    return format(date, "MMM d, h:mm a");
  } catch {
    return "—";
  }
}

export function ActivityTimeline({ events, className }: ActivityTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No activity recorded yet.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0", className)}>
      {events.map((event, i) => {
        const config = EVENT_CONFIG[event.type]!;
        const Icon = config.icon;
        const isLast = i === events.length - 1;

        return (
          <div key={event.id} className="relative flex gap-3">
            {/* Timeline dot */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                  config.bg,
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>
              {!isLast && <div className="h-full w-0.5 bg-border" />}
            </div>

            {/* Event content */}
            <div className={cn("min-w-0 flex-1 pb-5", isLast && "pb-0")}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{event.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatTimestamp(event.timestamp)}
                </span>
              </div>
              {event.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {event.description}
                </p>
              )}
              {event.actor && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  by {event.actor}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
