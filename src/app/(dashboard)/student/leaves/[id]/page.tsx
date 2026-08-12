"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  GraduationCap,
  Heart,
  HelpCircle,
  History,
  Home,
  Loader2,
  LogOut,
  MapPin,
  Moon,
  QrCode,
  RefreshCw,
  RotateCcw,
  Shield,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { QR_STATUS } from "@/constants/movement/qr-status";
import { VIEW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { ExtensionForm } from "@/features/extensions/components/ExtensionForm";
import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";
import { AskAQuestionSection, type QuestionItem } from "@/features/leaves/components/AskAQuestionSection";
import { DocumentList } from "@/features/leaves/components/DocumentList";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import { useMovement } from "@/hooks/use-movement";
import { useQrPasses } from "@/hooks/use-qr-passes";
import { useQrToken } from "@/hooks/use-qr-token";
import { cancelLeave, getQuestionsUrl } from "@/lib/api/leave-api";
import { generateQr } from "@/lib/api/movement-api";
import { formatDateTime, getDurationLabel } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

function getWaitingStepLabel(stepKey: string | null): string | null {
  const key = (stepKey ?? "").toUpperCase();
  if (!key || key === VIEW_STEP_KEY.POLICY || key === VIEW_STEP_KEY.SUBMITTED || key === VIEW_STEP_KEY.COMPLETE) return null;
  if (key.includes("PARENT")) return "parent approval";
  if (key.includes("POC")) return "POC approval";
  if (key.includes("ADMIN")) return "admin approval";
  return null;
}

function getLeaveTypeIcon(leaveTypeName: string): React.ReactNode {
  const name = leaveTypeName?.toUpperCase() ?? "";
  const className = "h-7 w-7";
  if (name.includes("HOME") || name.includes("PASS")) return <Home className={className} />;
  if (name.includes("MEDICAL") || name.includes("HEALTH") || name.includes("SICK")) return <Heart className={className} />;
  if (name.includes("EXAM") || name.includes("STUDY") || name.includes("ACADEM") || name.includes("EDUCATION")) return <GraduationCap className={className} />;
  if (name.includes("INTERN") || name.includes("JOB") || name.includes("PROFESSIONAL") || name.includes("PLACEMENT")) return <Briefcase className={className} />;
  if (name.includes("NIGHT") || name.includes("STAY") || name.includes("OVERNIGHT")) return <Moon className={className} />;
  if (name.includes("HOSTEL") || name.includes("CAMPUS") || name.includes("DORM")) return <Building2 className={className} />;
  if (name.includes("GENERAL") || name.includes("CASUAL") || name.includes("LOCAL") || name.includes("OUTING") || name.includes("PERSONAL")) return <MapPin className={className} />;
  return <Calendar className={className} />;
}

function getLeaveTypeColor(leaveTypeName: string): string {
  const name = leaveTypeName?.toUpperCase() ?? "";
  if (name.includes("MEDICAL") || name.includes("HEALTH")) return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  if (name.includes("EMERGENCY")) return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
  if (name.includes("STUDY") || name.includes("EXAM") || name.includes("ACADEMIC")) return "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20";
  if (name.includes("INTERN") || name.includes("JOB") || name.includes("PROFESSIONAL")) return "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20";
  if (name.includes("HOME") || name.includes("PASS")) return "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20";
  if (name.includes("NIGHT") || name.includes("STAY") || name.includes("OVERNIGHT")) return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (name.includes("CASUAL") || name.includes("LOCAL") || name.includes("OUTING")) return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
  if (name.includes("GENERAL")) return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
  return "bg-muted text-muted-foreground border-border";
}

// ─── Shared Sub-Components ──────────────────────────────────

function StatusChip({ variant, children }: { variant: "success" | "warning" | "error" | "muted"; children: React.ReactNode }) {
  const styles = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
    warning: "border-amber-500/30 bg-amber-500/5 text-amber-600",
    error: "border-red-500/30 bg-red-500/5 text-red-600",
    muted: "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", styles[variant])}>
      {children}
    </span>
  );
}

// ─── Summary Hero ───────────────────────────────────────────

type PolicyCheck = { key: string; label: string; passed: boolean; message?: string };

function SummaryHero({ leave }: { leave: Record<string, unknown> }) {
  const status = (leave.status as string)?.toLowerCase();
  const destination = leave.destination as string | undefined;
  const currentStepKey = (leave.currentStepKey as string | null) ?? null;
  const policyResult = leave.policyResult as { checks?: PolicyCheck[] } | null;
  const checks = policyResult?.checks ?? [];
  const passedCount = checks.filter((c) => c.passed).length;
  const allPassed = checks.length > 0 && passedCount === checks.length;
  const waitingStep = getWaitingStepLabel(currentStepKey);
  const isPending = status === "pending";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn("flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2", getLeaveTypeColor(leave.leaveTypeName as string))}>
            {getLeaveTypeIcon(leave.leaveTypeName as string)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-bold">{leave.leaveTypeName as string} Leave</h1>
              <StatusBadge status={status as "approved" | "pending" | "rejected" | "active" | "cancelled" | "expired" | "completed"} />
            </div>
            <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Start</span>
                <p className="mt-0.5 font-medium">{formatDateTime(leave.startAt as string)}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">End</span>
                <p className="mt-0.5 font-medium">{formatDateTime(leave.endAt as string)}</p>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Duration</span>
                <p className="mt-0.5 font-medium">{getDurationLabel(leave.startAt as string, leave.endAt as string)}</p>
              </div>
              {destination && (
                <div>
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Destination</span>
                  <p className="mt-0.5 font-medium">{destination}</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {isPending && waitingStep && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting for {waitingStep}
                </span>
              )}
              {checks.length > 0 && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                    allPassed
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-red-500/10 text-red-600 dark:text-red-400",
                  )}
                >
                  {allPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  Policy: {passedCount}/{checks.length} passed
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1.5 text-right text-sm">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Request</span>
          <span className="font-mono text-sm">{(leave.requestNumber as string) ?? (leave.id as string)?.slice(0, 8) ?? "—"}</span>
        </div>
      </div>

      {(leave.reason as string) && (
        <div className="border-t border-border bg-muted/30 px-6 py-3">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reason</span>
          <p className="mt-0.5 text-sm leading-relaxed">{leave.reason as string}</p>
        </div>
      )}
    </div>
  );
}

// ─── Unified Timeline ────────────────────────────────────

type TimelineEvent = {
  id: string;
  label: string;
  status: "approved" | "rejected" | "pending" | "info";
  actor: string | null;
  time: string | null;
};

function UnifiedTimeline({ leaveId, leave }: { leaveId: string; leave?: Record<string, unknown> }) {
  const { approvals, isLoading: loadingApprovals } = useApprovalChain(leaveId);
  const { movements, isLoading: loadingMovements } = useMovement({ leaveRequestId: leaveId, page: 1, limit: 50 });
  const { data: extData, isLoading: loadingExts } = useLeaveExtensions(leaveId);
  const { data: qData, isLoading: loadingQ } = useSWR<{ data: { items: QuestionItem[]; total: number } }>(
    getQuestionsUrl(leaveId, { limit: 50 }),
  );
  const { qrPasses, isLoading: loadingQr } = useQrPasses(leaveId);

  const events = useMemo<TimelineEvent[]>(() => {
    const items: TimelineEvent[] = [];

    const submittedAt = (leave?.submittedAt ?? leave?.createdAt) as string | null;

    // 1. Submitted
    if (submittedAt) {
      items.push({ id: "submitted", label: "Leave Submitted", status: "approved", actor: null, time: submittedAt });
    }

    // 2. Policy check — derived from the real policy result (not fabricated)
    const policyResult = leave?.policyResult as { checks?: PolicyCheck[] } | null;
    const checks = policyResult?.checks ?? [];
    if (checks.length > 0) {
      const passedCount = checks.filter((c) => c.passed).length;
      const allPassed = passedCount === checks.length;
      items.push({
        id: "policy-check",
        label: `Policy Check — ${passedCount}/${checks.length} passed`,
        status: allPassed ? "approved" : "rejected",
        actor: null,
        time: submittedAt,
      });
    }

    // 3. Approval chain steps
    const sortedApprovals = [...approvals].sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0));
    const hasRejection = sortedApprovals.some((a) => (a.decision ?? "").toLowerCase() === "rejected");

    for (const app of sortedApprovals) {
      const decision = (app.decision ?? "pending").toLowerCase();
      const stepLabel = app.stepKey?.replace(/_/g, " ") ?? `Step ${app.stepOrder}`;
      items.push({
        id: `app-${app.id}`,
        label: stepLabel,
        status: decision === "approved" || decision === "auto_approved" ? "approved" : decision === "rejected" ? "rejected" : "pending",
        actor: app.approverName ?? app.approverRoleCode ?? null,
        time: app.createdAt as string | null,
      });
    }

    // 4. Final decision: only when rejected (an approved leave already shows
    //    every step green — a redundant "Approved" tail node adds no info)
    if (hasRejection) {
      const rejectApp = sortedApprovals.find((a) => (a.decision ?? "").toLowerCase() === "rejected");
      items.push({
        id: "decision",
        label: "Rejected",
        status: "rejected",
        actor: rejectApp?.approverName ?? null,
        time: (rejectApp?.createdAt as string | null) ?? null,
      });
    }

    // 5. QR pass events (at most one pass per leave)
    for (const pass of qrPasses) {
      const time = (pass.createdAt ?? pass.generatedAt) as string | null;
      if (time) {
        items.push({
          id: `qr-${pass.id}`,
          label:
            pass.status === QR_STATUS.ACTIVE
              ? "QR Pass Generated"
              : pass.status === QR_STATUS.USED
                ? "QR Pass Used"
                : pass.status === QR_STATUS.EXPIRED
                  ? "QR Pass Expired"
                  : "QR Pass Invalidated",
          status: pass.status === QR_STATUS.ACTIVE || pass.status === QR_STATUS.USED ? "approved" : "info",
          actor: null,
          time,
        });
      }
    }

    // 6. Movement events
    for (const m of movements) {
      const mov = m as Record<string, unknown>;
      if (mov.createdAt) {
        const event = (mov.eventType as string) ?? "";
        const label = event === "EXIT_HOSTEL" ? "Left Hostel" :
                      event === "ENTER_HOSTEL" ? "Entered Hostel" :
                      event === "EXIT_CAMPUS" ? "Left Campus" :
                      event === "ENTER_CAMPUS" ? "Entered Campus" :
                      event === "LEAVE_APPROVED" ? "Movement Allowed" :
                      event === "AUTO_OVERDUE" ? "Marked Overdue" :
                      event === "MANUAL_RETURN" ? "Manual Return" :
                      event === "SECURITY_OVERRIDE" ? "Security Override" :
                      event.replace(/_/g, " ");
        items.push({
          id: `mov-${mov.id as string}`,
          label,
          status: event.includes("ENTER") ? "approved" : event.includes("OVERDUE") ? "rejected" : "info",
          actor: null,
          time: mov.createdAt as string,
        });
      }
    }

    // 7. Questions
    const questions = qData?.data?.items ?? [];
    for (const q of questions) {
      items.push({
        id: `q-${q.id}`,
        label: `Question: ${q.question.length > 50 ? q.question.slice(0, 50) + "..." : q.question}`,
        status: q.status === "answered" ? "approved" : "pending",
        actor: q.askedByName,
        time: q.createdAt,
      });
      if (q.answer && q.answeredAt) {
        items.push({
          id: `qa-${q.id}`,
          label: "Student Answered",
          status: "approved",
          actor: null,
          time: q.answeredAt,
        });
      }
    }

    // 8. Extension events
    const exts = (extData?.items as Array<Record<string, unknown>>) ?? [];
    for (const ext of exts) {
      const extStatus = (ext.status as string ?? "").toLowerCase();
      const extNum = ext.extensionNumber as number;
      if (ext.createdAt) {
        items.push({
          id: `ext-${ext.id as string}`,
          label: `Extension #${extNum} Requested`,
          status: "pending",
          actor: null,
          time: ext.createdAt as string,
        });
      }
      const approvedAt = ext.approvedAt as string | null;
      const rejectedAt = ext.rejectedAt as string | null;
      if (extStatus === "approved" && approvedAt) {
        items.push({
          id: `ext-approved-${ext.id as string}`,
          label: `Extension #${extNum} Approved`,
          status: "approved",
          actor: null,
          time: approvedAt,
        });
      }
      if (extStatus === "rejected" && rejectedAt) {
        items.push({
          id: `ext-rejected-${ext.id as string}`,
          label: `Extension #${extNum} Rejected`,
          status: "rejected",
          actor: null,
          time: rejectedAt,
        });
      }
    }

    // 9. Completed
    const leaveStatus = (leave?.status as string ?? "").toLowerCase();
    if (leaveStatus === "completed" || leaveStatus === "expired") {
      items.push({
        id: "complete",
        label: leaveStatus === "completed" ? "Leave Completed" : "Leave Expired",
        status: "approved",
        actor: null,
        time: (leave?.completedAt ?? leave?.expiredAt) as string ?? null,
      });
    }

    items.sort((a, b) => new Date(a.time ?? 0).getTime() - new Date(b.time ?? 0).getTime());
    return items;
  }, [approvals, movements, qrPasses, qData, extData, leave]);

  if (loadingApprovals || loadingMovements || loadingExts || loadingQ || loadingQr) return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <CollapsibleSection title="Timeline" icon={History}>
      {events.length <= 1 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No timeline events yet</p>
      ) : (
        <div className="relative">
          {events.map((item, i) => {
            const isLast = i === events.length - 1;
            return (
              <div key={item.id} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                    item.status === "approved" ? "border-emerald-500 bg-emerald-500/10" :
                    item.status === "rejected" ? "border-red-500 bg-red-500/10" :
                    item.status === "pending" ? "border-amber-500 bg-amber-500/10" :
                    "border-blue-500/30 bg-blue-500/5",
                  )}>
                    {item.status === "approved" ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> :
                     item.status === "rejected" ? <XCircle className="h-4 w-4 text-red-500" /> :
                     item.status === "pending" ? <Clock className="h-4 w-4 text-amber-500" /> :
                     item.id.startsWith("mov-") ? <LogOut className="h-4 w-4 text-blue-500" /> :
                     item.id.startsWith("q-") ? <HelpCircle className="h-4 w-4 text-violet-500" /> :
                     item.id.startsWith("ext-") ? <RotateCcw className="h-4 w-4 text-orange-500" /> :
                     <Shield className="h-4 w-4 text-blue-500" />}
                  </div>
                  {!isLast && <div className="h-full w-px bg-border" />}
                </div>
                <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold capitalize">{item.label}</span>
                    <StatusChip variant={
                      item.status === "approved" ? "success" :
                      item.status === "rejected" ? "error" :
                      item.status === "pending" ? "warning" : "muted"
                    }>
                      {item.status === "approved" ? "Done" :
                       item.status === "rejected" ? "Rejected" :
                       item.status === "pending" ? "Waiting" : "Info"}
                    </StatusChip>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {item.actor && <span className="font-medium">{item.actor}</span>}
                    {item.actor && item.time && <span>·</span>}
                    {item.time && <span>{formatRelative(item.time)}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CollapsibleSection>
  );
}

// ─── QR Pass Section ────────────────────────────────────────

function QRPassSection({ leaveId }: { leaveId: string }) {
  const [generating, setGenerating] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [fullscreenQr, setFullscreenQr] = useState(false);
  const { qrPasses, mutate } = useQrPasses(leaveId);
  const { storeToken, getToken } = useQrToken();

  const activePass = qrPasses.find((p) => p.status === QR_STATUS.ACTIVE);
  const latestPass = qrPasses[0] ?? null;
  // One token per leave, served by the API — the same QR is always shown.
  // sessionStorage is only a fallback for passes from before raw tokens were
  // stored server-side.
  const qrToken = activePass ? (activePass.token ?? getToken(activePass.id) ?? null) : null;
  const needsLegacyRepair = !!activePass && !activePass.token && !getToken(activePass.id);

  const refresh = () => { mutate(); };

  // Only reachable when no pass exists (legacy) or a legacy pass needs its
  // stored token written once. Never invalidates or re-issues an active pass.
  const handleGenerate = async () => {
    if (!leaveId) return;
    setGenerating(true);
    setQrError(null);
    try {
      const result = (await generateQr(leaveId, "LEAVE_EXIT")) as { passId: string; token: string } | null;
      if (result?.passId && result?.token) {
        storeToken(result.passId, result.token, leaveId);
        toast.success("QR pass ready");
      } else if (result?.passId) {
        toast.success("QR pass already active");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load QR pass";
      toast.error(msg);
      setQrError(msg);
    } finally {
      setGenerating(false);
      refresh();
    }
  };

  const latestPassConfig = latestPass
    ? latestPass.status === QR_STATUS.USED
      ? { label: "QR Pass Used", detail: "You've completed your leave and returned to the hostel." }
      : latestPass.status === QR_STATUS.EXPIRED
        ? { label: "QR Pass Expired", detail: latestPass.expiresAt ? `Expired ${formatDateTime(latestPass.expiresAt)}` : "This pass expired." }
        : latestPass.status === QR_STATUS.INVALIDATED
          ? { label: "QR Pass Invalidated", detail: latestPass.invalidatedAt ? `Invalidated ${formatDateTime(latestPass.invalidatedAt)}` : "This pass was invalidated." }
          : null
    : null;

  return (
    <CollapsibleSection title="QR Pass" icon={QrCode} defaultOpen={!!activePass || !!latestPass}>
      {activePass ? (
        qrToken ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              {/* QR Code */}
              <button type="button" onClick={() => setFullscreenQr(true)} className="shrink-0 cursor-pointer">
                <QrCodeDisplay token={qrToken} size={160} />
              </button>

              {/* Status info */}
              <div className="min-w-0 flex-1 self-center sm:self-auto">
                <p className="text-center text-sm font-medium text-emerald-600 sm:text-left">QR Ready</p>
                <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium text-emerald-600">Active</span>
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-medium">{activePass.expiresAt ? formatDateTime(activePass.expiresAt) : "—"}</span>
                  <span className="text-muted-foreground">Exit Scan</span>
                  <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                    {activePass.firstScanAt ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600">{formatDateTime(activePass.firstScanAt)}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" /> Pending
                      </>
                    )}
                  </span>
                  <span className="text-muted-foreground">Return Scan</span>
                  <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                    {activePass.closedAt ? (
                      <>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-600">{formatDateTime(activePass.closedAt)}</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3" /> Pending
                      </>
                    )}
                  </span>
                </div>
                <p className="mt-2 text-center text-[10px] text-muted-foreground sm:text-left">
                  Tap QR code for fullscreen
                </p>
              </div>
            </div>
          </div>
        ) : needsLegacyRepair ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-7 w-7 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-600">QR pass created before this upgrade</p>
                <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
                  Your pass was created before QR codes were stored on the server. Tap below once to retrieve it —
                  the same QR stays valid for this leave.
                </p>
              </div>
              <Button onClick={handleGenerate} disabled={generating} size="sm" className="gap-2">
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Show QR Pass
                  </>
                )}
              </Button>
              {qrError && <div className="w-full rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{qrError}</div>}
            </div>
          </div>
        ) : null
      ) : latestPass && latestPassConfig ? (
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              latestPass.status === QR_STATUS.USED ? "bg-emerald-500/10" : "bg-muted",
            )}>
              {latestPass.status === QR_STATUS.USED ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">{latestPassConfig.label}</p>
              <p className="text-xs text-muted-foreground">{latestPassConfig.detail}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-dashed border-border p-4">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium text-muted-foreground">Not Generated</span>
              <span className="text-muted-foreground">Expires</span>
              <span className="text-muted-foreground">—</span>
              <span className="text-muted-foreground">Exit Scan</span>
              <span className="text-muted-foreground">Pending</span>
              <span className="text-muted-foreground">Return Scan</span>
              <span className="text-muted-foreground">Pending</span>
            </div>
          </div>

          {qrError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{qrError}</div>}

          <Button onClick={handleGenerate} disabled={generating} className="w-full gap-2">
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</> : <><QrCode className="h-4 w-4" /> Generate QR Pass</>}
          </Button>
        </div>
      )}

      {/* Fullscreen QR overlay */}
      {fullscreenQr && qrToken && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setFullscreenQr(false)}
        >
          <div className="rounded-2xl bg-white p-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <QrCodeDisplay token={qrToken} size={320} />
          </div>
        </div>
      )}
    </CollapsibleSection>
  );
}

// ─── Extensions Section ─────────────────────────────────────

function ExtensionsSection({ leaveId }: { leaveId: string }) {
  const { data, isLoading, isError } = useLeaveExtensions(leaveId);
  const [showAll, setShowAll] = useState(false);

  const items = data?.items ?? [];

  if (isLoading) return <CollapsibleSection title="Extensions" icon={RotateCcw}><div className="flex items-center justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></CollapsibleSection>;
  if (isError) return <CollapsibleSection title="Extensions" icon={RotateCcw}><p className="py-4 text-center text-sm text-destructive">Failed to load extensions</p></CollapsibleSection>;
  if (items.length === 0) return null;

  const displayed = showAll ? items : items.slice(0, 3);

  return (
    <CollapsibleSection title="Extensions" icon={RotateCcw} defaultOpen={true}>
      <div className="space-y-3">
        {displayed.map((ext) => {
          const extStatus = (ext.status ?? "").toLowerCase();
          return (
            <div key={ext.id} className="flex gap-3 rounded-xl border border-border p-3">
              <div className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                extStatus === "approved" ? "bg-emerald-500/10 text-emerald-500" :
                extStatus === "rejected" ? "bg-red-500/10 text-red-500" :
                "bg-amber-500/10 text-amber-500",
              )}>
                {extStatus === "approved" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                 extStatus === "rejected" ? <XCircle className="h-3.5 w-3.5" /> :
                 <Clock className="h-3.5 w-3.5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Extension #{ext.extensionNumber}</span>
                  <StatusChip variant={extStatus === "approved" ? "success" : extStatus === "rejected" ? "error" : "warning"}>
                    {extStatus === "approved" ? "Approved" : extStatus === "rejected" ? "Rejected" : "Pending"}
                  </StatusChip>
                </div>
                {ext.createdAt && <p className="mt-0.5 text-xs text-muted-foreground">{formatRelative(ext.createdAt)}</p>}
                {ext.reason && <p className="mt-1 text-xs text-muted-foreground">{ext.reason}</p>}
              </div>
            </div>
          );
        })}

        {items.length > 3 && !showAll && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(true)} className="w-full gap-1 text-xs">
            <ChevronDown className="h-3 w-3" />
            View all {items.length} extensions
          </Button>
        )}
        {showAll && items.length > 3 && (
          <Button variant="ghost" size="sm" onClick={() => setShowAll(false)} className="w-full gap-1 text-xs">
            Show less
          </Button>
        )}
      </div>
    </CollapsibleSection>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function StudentLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { leave, isLoading, isError, error, mutate } = useLeave(id);

  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [extending, setExtending] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelLeave(id);
      toast.success("Leave cancelled");
      await mutate();
      setShowCancel(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel leave");
    } finally {
      setCancelling(false);
    }
  };

  const handleExtensionSuccess = () => {
    setExtending(false);
    mutate();
  };

  if (isLoading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message={error?.message ?? "Leave not found"} onRetry={() => mutate()} />;
  if (!leave) return <ErrorState message="Leave not found" />;

  const status = (leave.status as string)?.toLowerCase();
  const isPending = status === "pending";
  const isApproved = status === "approved";
  const isCancellable = isPending || isApproved;

  const studentName = (leave.userFullName as string) || `${leave.studentFirstName ?? ""} ${leave.studentLastName ?? ""}`.trim() || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push("/student/leaves")} className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-mono text-base">{leave.requestNumber ?? (leave.id as string)?.slice(0, 8)}</span>
          </div>
        }
        description={
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{leave.leaveTypeName as string} Leave</span>
            {studentName && <><span className="text-muted-foreground/50">·</span><span>{studentName}</span></>}
          </div>
        }
        action={
          <Button variant="outline" size="sm" onClick={() => mutate()} className="gap-1.5">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {/* 1. Summary Hero */}
      <SummaryHero leave={leave as unknown as Record<string, unknown>} />

      {/* 2. Actions bar (above timeline) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {isCancellable && (
            <Button variant="destructive" size="sm" onClick={() => setShowCancel(true)} className="gap-1.5">
              <XCircle className="h-4 w-4" />
              Cancel Leave
            </Button>
          )}
          {isApproved && (
            <Button variant="default" size="sm" onClick={() => setExtending(!extending)} className="gap-1.5">
              <RotateCcw className="h-4 w-4" />
              {extending ? "Close" : "Request Extension"}
            </Button>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => router.push("/student/leaves")} className="gap-1.5">
          <History className="h-4 w-4" />
          All Leaves
        </Button>
      </div>

      {/* 3. Timeline */}
      <UnifiedTimeline leaveId={id} leave={leave as unknown as Record<string, unknown>} />

      {/* Extension Form */}
      {extending && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Request Extension
          </h3>
          <ExtensionForm
            leaveId={id}
            currentEndAt={leave.endAt as string}
            onSuccess={handleExtensionSuccess}
            onCancel={() => setExtending(false)}
          />
        </div>
      )}

      {/* 4. QR Pass */}
      {isApproved && <QRPassSection leaveId={id} />}

      {/* 5. Questions */}
      <AskAQuestionSection leaveId={id} />

      {/* 6. Documents */}
      <DocumentList leaveId={id} />

      {/* 7. Extensions */}
      <ExtensionsSection leaveId={id} />

      {/* Cancel Confirmation */}
      <ConfirmationDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel Leave"
        description={
          isApproved
            ? "Are you sure you want to cancel this approved leave? Your active QR pass (if any) will be invalidated. This action cannot be undone."
            : "Are you sure you want to cancel this leave request? This action cannot be undone."
        }
        confirmLabel="Yes, Cancel Leave"
        variant="destructive"
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </div>
  );
}
