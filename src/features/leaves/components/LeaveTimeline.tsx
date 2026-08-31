"use client";

import {
  Check,
  Clock,
  HelpCircle,
  History,
  LogOut,
  Repeat,
  Shield,
  X,
} from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { RowSkeleton } from "@/design-system/sst";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";
import type { QuestionItem } from "@/features/leaves/components/AskAQuestionSection";
import { useMovement } from "@/hooks/use-movement";
import { useQrPasses } from "@/hooks/use-qr-passes";
import { getQuestionsUrl } from "@/lib/api/leave-api";
import { formatRelative } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

import type { PolicyCheck } from "./LeaveSummary";

type EventStatus = "done" | "rejected" | "waiting" | "info";

type TimelineEvent = {
  id: string;
  label: string;
  status: EventStatus;
  actor: string | null;
  time: string | null;
};

const MARKER: Record<EventStatus, { ring: string; icon: string }> = {
  done: { ring: "border-success bg-success-light", icon: "text-success" },
  rejected: { ring: "border-danger bg-danger-light", icon: "text-danger" },
  waiting: { ring: "border-warning bg-warning-light", icon: "text-warning" },
  info: { ring: "border-border-strong bg-surface-sunken", icon: "text-muted" },
};

const MOVEMENT_LABEL: Record<string, string> = {
  EXIT_HOSTEL: "Left the hostel",
  ENTER_HOSTEL: "Returned to the hostel",
  EXIT_CAMPUS: "Left campus",
  ENTER_CAMPUS: "Entered campus",
  LEAVE_APPROVED: "Cleared to leave",
  AUTO_OVERDUE: "Marked overdue",
  MANUAL_RETURN: "Return recorded by staff",
  SECURITY_OVERRIDE: "Security override",
};

const QR_LABEL: Record<string, string> = {
  [QR_STATUS.ACTIVE]: "Gate pass issued",
  [QR_STATUS.USED]: "Gate pass used",
  [QR_STATUS.EXPIRED]: "Gate pass expired",
  [QR_STATUS.INVALIDATED]: "Gate pass invalidated",
};

function MarkerIcon({ status, id }: { status: EventStatus; id: string }) {
  const className = cn("h-4 w-4", MARKER[status].icon);
  if (status === "done") return <Check className={className} aria-hidden />;
  if (status === "rejected") return <X className={className} aria-hidden />;
  if (status === "waiting") return <Clock className={className} aria-hidden />;
  if (id.startsWith("mov-")) return <LogOut className={className} aria-hidden />;
  if (id.startsWith("q-")) return <HelpCircle className={className} aria-hidden />;
  if (id.startsWith("ext-")) return <Repeat className={className} aria-hidden />;
  return <Shield className={className} aria-hidden />;
}

/**
 * Everything that has happened to this request, in one ordered list.
 *
 * Leave is permission and movement is reality, so the two are gathered here
 * for the reader without being merged in the data: approvals come from the
 * approval chain, movements from movement_events, and each keeps its own
 * source.
 */
export function LeaveTimeline({
  leaveId,
  leave,
}: {
  leaveId: string;
  leave?: Record<string, unknown>;
}) {
  const { approvals, isLoading: loadingApprovals } = useApprovalChain(leaveId);
  const { movements, isLoading: loadingMovements } = useMovement({
    leaveRequestId: leaveId,
    page: 1,
    limit: 50,
  });
  const { data: extensionData, isLoading: loadingExtensions } =
    useLeaveExtensions(leaveId);
  const { data: questionData, isLoading: loadingQuestions } = useSWR<{
    data: { items: QuestionItem[]; total: number };
  }>(getQuestionsUrl(leaveId, { limit: 50 }));
  const { qrPasses, isLoading: loadingPasses } = useQrPasses(leaveId);

  const events = useMemo<TimelineEvent[]>(() => {
    const items: TimelineEvent[] = [];
    const submittedAt = (leave?.submittedAt ?? leave?.createdAt) as
      | string
      | null;

    if (submittedAt) {
      items.push({
        id: "submitted",
        label: "Request submitted",
        status: "done",
        actor: null,
        time: submittedAt,
      });
    }

    // Derived from the real policy result, never fabricated.
    const checks =
      (leave?.policyResult as { checks?: PolicyCheck[] } | null)?.checks ?? [];
    if (checks.length > 0) {
      const passed = checks.filter((check) => check.passed).length;
      items.push({
        id: "policy-check",
        label: `Policy check — ${passed} of ${checks.length} passed`,
        status: passed === checks.length ? "done" : "rejected",
        actor: null,
        time: submittedAt,
      });
    }

    const sorted = [...approvals].sort(
      (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)
    );
    for (const approval of sorted) {
      const decision = (approval.decision ?? "pending").toLowerCase();
      items.push({
        id: `app-${approval.id}`,
        label: approval.stepKey?.replace(/_/g, " ") ?? `Step ${approval.stepOrder}`,
        status:
          decision === "approved" || decision === "auto_approved"
            ? "done"
            : decision === "rejected"
              ? "rejected"
              : "waiting",
        actor: approval.approverName ?? approval.approverRoleCode ?? null,
        time: approval.createdAt as string | null,
      });
    }

    // Only surfaced on rejection: an approved request already shows every step
    // done, so a trailing "Approved" node repeats what is above it.
    const rejected = sorted.find(
      (approval) => (approval.decision ?? "").toLowerCase() === "rejected"
    );
    if (rejected) {
      items.push({
        id: "decision",
        label: "Request rejected",
        status: "rejected",
        actor: rejected.approverName ?? null,
        time: (rejected.createdAt as string | null) ?? null,
      });
    }

    for (const pass of qrPasses) {
      const time = (pass.createdAt ?? pass.generatedAt) as string | null;
      if (!time) continue;
      items.push({
        id: `qr-${pass.id}`,
        label: QR_LABEL[pass.status] ?? "Gate pass updated",
        status:
          pass.status === QR_STATUS.ACTIVE || pass.status === QR_STATUS.USED
            ? "done"
            : "info",
        actor: null,
        time,
      });
    }

    for (const movement of movements) {
      const row = movement as Record<string, unknown>;
      if (!row.createdAt) continue;
      const event = (row.eventType as string) ?? "";
      items.push({
        id: `mov-${row.id as string}`,
        label: MOVEMENT_LABEL[event] ?? event.replace(/_/g, " ").toLowerCase(),
        status: event.includes("ENTER")
          ? "done"
          : event.includes("OVERDUE")
            ? "rejected"
            : "info",
        actor: null,
        time: row.createdAt as string,
      });
    }

    for (const question of questionData?.data?.items ?? []) {
      items.push({
        id: `q-${question.id}`,
        label: `Asked: ${question.question.length > 60 ? `${question.question.slice(0, 60)}…` : question.question}`,
        status: question.status === "answered" ? "done" : "waiting",
        actor: question.askedByName,
        time: question.createdAt,
      });
      if (question.answer && question.answeredAt) {
        items.push({
          id: `qa-${question.id}`,
          label: "You answered",
          status: "done",
          actor: null,
          time: question.answeredAt,
        });
      }
    }

    for (const raw of (extensionData?.items as Array<Record<string, unknown>>) ??
      []) {
      const number = raw.extensionNumber as number;
      const status = ((raw.status as string) ?? "").toLowerCase();
      if (raw.createdAt) {
        items.push({
          id: `ext-${raw.id as string}`,
          label: `Extension ${number} requested`,
          status: "waiting",
          actor: null,
          time: raw.createdAt as string,
        });
      }
      const approvedAt = raw.approvedAt as string | null;
      const rejectedAt = raw.rejectedAt as string | null;
      if (status === "approved" && approvedAt) {
        items.push({
          id: `ext-approved-${raw.id as string}`,
          label: `Extension ${number} approved`,
          status: "done",
          actor: null,
          time: approvedAt,
        });
      }
      if (status === "rejected" && rejectedAt) {
        items.push({
          id: `ext-rejected-${raw.id as string}`,
          label: `Extension ${number} rejected`,
          status: "rejected",
          actor: null,
          time: rejectedAt,
        });
      }
    }

    const leaveStatus = ((leave?.status as string) ?? "").toLowerCase();
    if (leaveStatus === "completed" || leaveStatus === "expired") {
      items.push({
        id: "complete",
        label: leaveStatus === "completed" ? "Leave completed" : "Leave expired",
        status: leaveStatus === "completed" ? "done" : "info",
        actor: null,
        time: ((leave?.completedAt ?? leave?.expiredAt) as string) ?? null,
      });
    }

    return items.sort(
      (a, b) => new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime()
    );
  }, [approvals, movements, qrPasses, questionData, extensionData, leave]);

  const loading =
    loadingApprovals ||
    loadingMovements ||
    loadingExtensions ||
    loadingQuestions ||
    loadingPasses;

  return (
    <CollapsibleSection
      title="Timeline"
      icon={History}
      meta={events.length > 0 ? `${events.length} events` : undefined}
    >
      {loading ? (
        <RowSkeleton rows={3} />
      ) : events.length <= 1 ? (
        <p className="py-4 text-center text-caption text-muted">
          Nothing has happened yet beyond the request itself.
        </p>
      ) : (
        <ol className="relative">
          {events.map((event, index) => {
            const isLast = index === events.length - 1;

            return (
              <li key={event.id} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                      MARKER[event.status].ring
                    )}
                  >
                    <MarkerIcon status={event.status} id={event.id} />
                  </span>
                  {!isLast && <span className="h-full w-px bg-border" />}
                </div>

                <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
                  <p className="text-small font-semibold capitalize text-ink">
                    {event.label}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-caption text-muted">
                    {event.actor && (
                      <span className="font-medium">{event.actor}</span>
                    )}
                    {event.actor && event.time && <span aria-hidden>·</span>}
                    {event.time && <span>{formatRelative(event.time)}</span>}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </CollapsibleSection>
  );
}
