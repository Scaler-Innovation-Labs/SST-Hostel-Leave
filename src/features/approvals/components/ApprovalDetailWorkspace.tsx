"use client";

import { format, parseISO } from "date-fns";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  Phone,
  XCircle,
} from "lucide-react";
import { useState } from "react";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useDocuments } from "@/hooks/use-documents";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

import { ActivityTimeline, type ActivityEvent } from "./ActivityTimeline";
import { WorkflowProgress } from "./WorkflowProgress";
import { WorkflowTimeline, type WorkflowStep } from "./WorkflowTimeline";

type ApprovalDetailWorkspaceProps = {
  leaveId: string;
  onBack: () => void;
  onActionComplete: () => void;
};

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0] ?? "").filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function getDuration(startAt: string, endAt: string): string {
  try {
    const start = parseISO(startAt);
    const end = parseISO(endAt);
    const diffMs = end.getTime() - start.getTime();
    const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (days === 0) return "Same day";
    return `${days}d`;
  } catch { return "—"; }
}

function formatDate(dateStr: string): string {
  try { return format(parseISO(dateStr), "MMM d"); } catch { return dateStr.split("T")[0] ?? "—"; }
}

const avatarColors = [
  "bg-blue-500/10 text-blue-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-amber-500/10 text-amber-600",
  "bg-rose-500/10 text-rose-600",
];

type SectionId = "workflow" | "timeline" | "policy" | "documents" | "comments";

const SECTION_LABELS: Record<SectionId, string> = {
  workflow: "Approval Workflow",
  timeline: "Activity",
  policy: "Policy Evaluation",
  documents: "Attachments",
  comments: "Comments",
};

export function ApprovalDetailWorkspace({
  leaveId,
  onBack,
  onActionComplete,
}: ApprovalDetailWorkspaceProps) {
  const { leave, isLoading: leaveLoading, isError: leaveError, mutate: leaveMutate } = useLeave(leaveId);
  const { approvals, isLoading: chainLoading, isError: chainError, mutate: chainMutate } = useApprovalChain(leaveId);
  const { documents } = useDocuments(leaveId);

  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set());
  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comments, setComments] = useState("");

  const isLoading = leaveLoading || chainLoading;
  const isError = leaveError || chainError;
  const isPending = leave?.status === LEAVE_REQUEST_STATUS.PENDING;

  function toggleSection(id: SectionId) {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const workflowSteps: WorkflowStep[] = approvals
    ? [...approvals].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0)).map((app) => ({
        id: app.id, stepKey: app.stepKey, stepOrder: app.stepOrder,
        decision: app.decision?.toLowerCase(), approverRoleCode: app.approverRoleCode,
        approverName: app.approverName, comments: app.comments, createdAt: app.createdAt,
        isCurrent: app.decision?.toLowerCase() === "pending",
      }))
    : [];

  const stepDots = [
    { key: "submitted", label: "Submitted", status: "completed" as const },
    { key: "policy", label: "Policy", status: (leave?.status === LEAVE_REQUEST_STATUS.PENDING || leave?.status === LEAVE_REQUEST_STATUS.REJECTED) && !approvals?.some(a => a.decision === LEAVE_APPROVAL_DECISION.APPROVED || a.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED || a.decision === LEAVE_APPROVAL_DECISION.REJECTED) ? "current" as const : "completed" as const },
    ...(approvals ? approvals.map(a => ({
      key: a.stepKey ?? a.id, label: a.approverRoleCode ?? "Step",
      status: a.decision === LEAVE_APPROVAL_DECISION.APPROVED || a.decision === LEAVE_APPROVAL_DECISION.AUTO_APPROVED ? "completed" as const :
              a.decision === LEAVE_APPROVAL_DECISION.REJECTED ? "failed" as const :
              a.decision === LEAVE_APPROVAL_DECISION.PENDING ? "current" as const : "pending" as const,
    })) : []),
  ];

  const activityEvents: ActivityEvent[] = [
    ...(leave?.createdAt ? [{ id: "submitted", type: "submitted" as const, label: "Leave Submitted", timestamp: leave.createdAt }] : []),
    ...(approvals ? approvals.filter(a => a.createdAt).map(a => ({
      id: `approval-${a.id}`,
      type: (a.decision?.toLowerCase() === "approved" ? "approved" : a.decision?.toLowerCase() === "rejected" ? "rejected" : "comment") as ActivityEvent["type"],
      label: a.decision?.toLowerCase() === "approved" ? "Approved by " + (a.approverName ?? a.approverRoleCode ?? "Unknown") :
             a.decision?.toLowerCase() === "rejected" ? "Rejected by " + (a.approverName ?? a.approverRoleCode ?? "Unknown") :
             "Pending review by " + (a.approverRoleCode ?? "Unknown"),
      timestamp: a.createdAt,
    })) : []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const handleAction = async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (actionTarget === "approve") await approveLeave(leaveId, comments || undefined);
      else await rejectLeave(leaveId, comments || undefined);
      setActionTarget(null);
      setComments("");
      await Promise.all([leaveMutate(), chainMutate()]);
      onActionComplete();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval action failed", { error: message });
    } finally { setActionLoading(false); }
  };

  if (isLoading) return <div className="rounded-xl border border-border p-6"><LoadingState count={4} /></div>;
  if (isError) return <ErrorState message="Failed to load leave details" onRetry={() => { leaveMutate(); chainMutate(); }} />;
  if (!leave) return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
      <FileText className="mb-3 h-12 w-12 text-muted-foreground/50" />
      <h3 className="text-base font-medium">Select an approval</h3>
      <p className="mt-1 text-sm text-muted-foreground">Click on a request from the queue to view details here.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Back button */}
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground xl:hidden">
        ← Back to queue
      </button>

      {/* ── LEVEL 1 — Compact Header ── */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            avatarColors[Math.abs((leave.userFullName ?? "").charCodeAt(0) || 0) % avatarColors.length])}>
            {getInitials(leave.userFullName ?? leave.studentRollNumber ?? "?")}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">{leave.userFullName ?? "—"}</h3>
              <StatusBadge status={(leave.status?.toLowerCase() ?? "pending") as "approved" | "pending" | "rejected" | "active"} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              <span className="font-mono">{leave.studentRollNumber}</span>
              {leave.userEmail && <span className="inline-flex items-center gap-1"><Mail className="h-3 w-3" />{leave.userEmail}</span>}
              {leave.userPhone && <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{leave.userPhone}</span>}
              <span className="font-mono text-[10px]">{leave.requestNumber}</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1 font-medium text-foreground">
            <Globe className="h-3.5 w-3.5" />{leave.leaveTypeName ?? "Leave"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {formatDate(leave.startAt)}→{formatDate(leave.endAt)}
            <span className="ml-0.5 rounded bg-muted px-1 py-0.5 text-[10px] font-medium">{getDuration(leave.startAt, leave.endAt)}</span>
          </span>
        </div>

        <div className="mt-2 line-clamp-1 text-xs text-muted-foreground">{leave.reason ?? "—"}</div>

        {/* Compact workflow */}
        <div className="mt-3">
          <WorkflowProgress steps={stepDots} compact />
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex items-center gap-2 pt-3">
            <Button variant="destructive" size="sm" onClick={() => setActionTarget("reject")} disabled={actionLoading} className="gap-1 h-8 text-xs">
              <XCircle className="h-3.5 w-3.5" />Reject
            </Button>
            <Button size="sm" onClick={() => setActionTarget("approve")} disabled={actionLoading} className="gap-1 h-8 text-xs">
              <CheckCircle2 className="h-3.5 w-3.5" />Approve
            </Button>
          </div>
        )}

        {actionError && <div className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-500/10 dark:text-red-400">{actionError}</div>}
      </div>

      {/* ── LEVEL 2 — Collapsible sections ── */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {/* Workflow */}
        <CollapsibleSection id="workflow" label={SECTION_LABELS.workflow} isOpen={openSections.has("workflow")} onToggle={toggleSection}>
          <WorkflowTimeline steps={workflowSteps} />
        </CollapsibleSection>

        {/* Activity */}
        <CollapsibleSection id="timeline" label={SECTION_LABELS.timeline} isOpen={openSections.has("timeline")} onToggle={toggleSection}>
          <ActivityTimeline events={activityEvents} />
        </CollapsibleSection>

        {/* Policy */}
        <CollapsibleSection id="policy" label={SECTION_LABELS.policy} isOpen={openSections.has("policy")} onToggle={toggleSection}>
          <div className="space-y-2">
            {leave?.policyResult?.checks?.map((policy) => (
              <div key={policy.key} className={cn("flex items-center justify-between rounded-lg px-3 py-2 text-sm", policy.passed ? "bg-emerald-500/5" : "bg-red-500/5")}>
                <span className="flex items-center gap-2">
                  {policy.passed ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                  <span>{policy.label}</span>
                  {policy.message && <span className="text-xs text-muted-foreground">— {policy.message}</span>}
                </span>
                <span className={cn("text-xs font-medium", policy.passed ? "text-emerald-600" : "text-red-600")}>{policy.passed ? "Passed" : "Failed"}</span>
              </div>
            ))}
            {(!leave?.policyResult?.checks || leave.policyResult.checks.length === 0) && (
              <p className="text-sm text-muted-foreground">No policy checks configured for this leave type.</p>
            )}
          </div>
        </CollapsibleSection>

        {/* Documents */}
        <CollapsibleSection id="documents" label={`${SECTION_LABELS.documents} (${documents.length})`} isOpen={openSections.has("documents")} onToggle={toggleSection}>
          {documents.length > 0 ? (
            <div className="space-y-2">
              {documents.map((doc) => (
                <a key={doc.id} href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm transition-colors hover:bg-muted">
                  <span className="truncate">{doc.fileName}</span>
                  <ExternalLink className="ml-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </a>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No attachments.</p>}
        </CollapsibleSection>

        {/* Comments */}
        {isPending && (
          <CollapsibleSection id="comments" label={SECTION_LABELS.comments} isOpen={openSections.has("comments")} onToggle={toggleSection}>
            <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Add a note about your decision..." rows={3}
              className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors focus:border-ring focus:ring-1 focus:ring-ring" />
          </CollapsibleSection>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmationDialog open={actionTarget === "approve"} onOpenChange={() => setActionTarget(null)} title="Approve Leave"
        description={comments ? `Approve this leave with your comment: "${comments}"` : "Are you sure you want to approve this leave request?"}
        confirmLabel="Approve" onConfirm={handleAction} loading={actionLoading} />
      <ConfirmationDialog open={actionTarget === "reject"} onOpenChange={() => setActionTarget(null)} title="Reject Leave"
        description={comments ? `Reject this leave with your comment: "${comments}"` : "Are you sure you want to reject this leave request?"}
        confirmLabel="Reject" variant="destructive" onConfirm={handleAction} loading={actionLoading} />
    </div>
  );
}

function CollapsibleSection({
  id, label, isOpen, onToggle, children,
}: {
  id: string;
  label: string;
  isOpen: boolean;
  onToggle: (id: any) => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button type="button" onClick={() => onToggle(id)}
        className="flex w-full items-center gap-2 px-4 py-3 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        {label}
      </button>
      {isOpen && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
