"use client";

import { parseISO } from "date-fns";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  History,
  Image,
  Info,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Send,
  Shield,
  ShieldAlert,
  User,
  Users,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ErrorState } from "@/components/shared/ErrorState";
import { LeaveTypeBadge } from "@/components/shared/LeaveTypeBadge";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type { LeaveApprovalDecision } from "@/constants/leave/leave-approval-decision";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import type { BadgeTone } from "@/design-system/sst";
import {
  APPROVAL_DECISION_PRESENTATION,
  Avatar,
  Badge,
  SectionCard,
  TONE_MARKER,
  TONE_TEXT,
} from "@/design-system/sst";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { AskAQuestionSection } from "@/features/leaves/components/AskAQuestionSection";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { useDocuments } from "@/hooks/use-documents";
import { useMovement } from "@/hooks/use-movement";
import { approveLeave, rejectLeave, superadminOverrideLeave } from "@/lib/api/approval-api";
import { getLeaveUrl } from "@/lib/api/leave-api";
import { formatDate, formatDateTime, formatRelative, getDurationLabel } from "@/lib/date-utils";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

type ApprovalDetailViewProps = {
  leaveId: string;
  onBack: () => void;
  /** Who is viewing — POC viewers get a simplified approve/reject dialog. */
  viewerRole?: "POC" | "ADMIN" | "SUPER_ADMIN";
};

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type LeaveApproval = {
  id: string;
  decision: string;
  stepKey: string;
  stepOrder: number;
  approverRoleCode: string | null;
  approverName?: string;
  comments: string | null;
  createdAt: string;
};

// ─── Constants ──────────────────────────────────────────────



const REJECTION_CATEGORIES = [
  { value: "incomplete", label: "Incomplete Information" },
  { value: "policy_violation", label: "Policy Violation" },
  { value: "attendance", label: "Low Attendance" },
  { value: "disciplinary", label: "Disciplinary Issue" },
  { value: "duplicate", label: "Duplicate Request" },
  { value: "other", label: "Other" },
];

const TAB_CONFIG = [
  { id: "overview", label: "Overview", icon: Eye },
  { id: "workflow", label: "Workflow", icon: Users },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "audit", label: "Audit", icon: History },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "questions", label: "Questions", icon: HelpCircle },
];


// ─── Helpers ────────────────────────────────────────────────





function getTimeWaiting(createdAt: string): string {
  try {
    const created = parseISO(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h waiting`;
    if (hours > 0) return `${hours}h waiting`;
    const mins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${mins}m waiting`;
  } catch {
    return "";
  }
}

function getDocumentIcon(mimeType: string | null, fileName: string): React.ElementType {
  if (!mimeType) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? "")) return Image;
    if (["pdf"].includes(ext ?? "")) return File;
    if (["xls", "xlsx", "csv"].includes(ext ?? "")) return FileSpreadsheet;
    if (["zip", "rar", "tar", "gz"].includes(ext ?? "")) return FileArchive;
    return File;
  }
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType.includes("pdf")) return File;
  if (mimeType.includes("spreadsheet") || mimeType.includes("csv")) return FileSpreadsheet;
  if (mimeType.includes("zip") || mimeType.includes("rar")) return FileArchive;
  return File;
}

// ─── Sub-components ─────────────────────────────────────────

function StatBadge({ label, value, variant }: { label: string; value: number; variant: "success" | "danger" | "warning" | "default" }) {
  const styles = {
    success: "text-success bg-success-light",
    danger: "text-danger bg-danger-light",
    warning: "text-warning bg-warning-light",
    default: "text-muted bg-surface-sunken",
  };
  return (
    <div className="text-center">
      <p className={cn("text-h3 font-semibold tabular-nums", styles[variant].split(" ")[0])}>{value}</p>
      <p className="text-micro uppercase tracking-wider text-muted">{label}</p>
    </div>
  );
}


function DetailRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <dt className="shrink-0 text-caption font-medium uppercase tracking-wider text-muted">{label}</dt>
      <dd className="text-right text-body font-medium">{children}</dd>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

/** A decision string from the API, resolved against the closed taxonomy. */
function decisionPresentation(decision: string) {
  return (
    APPROVAL_DECISION_PRESENTATION[decision as LeaveApprovalDecision] ??
    APPROVAL_DECISION_PRESENTATION.PENDING
  );
}

export function ApprovalDetailView({ leaveId, onBack, viewerRole }: ApprovalDetailViewProps) {
  // The override action is available to admins and super admins.
  const canOverride = viewerRole === "ADMIN" || viewerRole === "SUPER_ADMIN";
  // POC approval is a simple yes/no — notification/CC options are admin-only.
  const isPocViewer = viewerRole === "POC";

  // ── Data fetching ──
  const { data: rawLeaveData, isLoading: leaveLoading, error: leaveError, mutate: leaveMutate } = useSWR(
    leaveId ? getLeaveUrl(leaveId) : null,
  );

  const {
    approvals,
    isLoading: chainLoading,
    isError: chainError,
    mutate: chainMutate,
  } = useApprovalChain(leaveId);

  const { documents } = useDocuments(leaveId);
  const { movements } = useMovement({ leaveRequestId: leaveId, page: 1, limit: 50 });

  const { data: auditData, isLoading: auditLoading } = useSWR<{ data: AuditEntry[] }>(
    leaveId ? `/api/v1/audit?entityType=LEAVE_REQUEST&entityId=${leaveId}` : null,
  );

  // Student data
  const rawLeave = rawLeaveData?.data as {
    leave: Record<string, unknown>;
    student: Record<string, unknown> | null;
    user: Record<string, unknown> | null;
    leaveType: Record<string, unknown> | null;
  } | undefined;

  const leave = rawLeave?.leave ?? null;
  const student = rawLeave?.student ?? null;
  const user = rawLeave?.user ?? null;
  const leaveTypeRecord = rawLeave?.leaveType as Record<string, unknown> | null ?? {};
  const leaveTypeName = leaveTypeRecord.name as string | undefined;
  const leaveTypeCategory = leaveTypeRecord.category as string | undefined;
  const leaveTypeUiConfig = leaveTypeRecord.uiConfig as Record<string, unknown> | null ?? {};
  const isSpecialLeave = (leaveTypeUiConfig.isSpecial as boolean) ?? false;

  // Student leave stats
  const studentId = leave?.studentId as string | undefined;
  const { leaves: studentLeaves } = useLeaves(studentId ? { studentId, page: 1, limit: 100 } : undefined);

  // ── Derived state ──
  const isLoading = leaveLoading || chainLoading;
  const isError = !!leaveError || chainError;

  const requestNumber = (leave?.requestNumber as string) ?? leaveId ?? "Leave Detail";
  const status = ((leave?.status as string) ?? "").toLowerCase();
  const isPending = status === "pending";
  const leaveType = leaveTypeName ?? "—";
  const startAt = (leave?.startAt as string) ?? "";
  const endAt = (leave?.endAt as string) ?? "";
  const reason = (leave?.reason as string) ?? "—";
  const createdAt = (leave?.createdAt as string) ?? "";
  const destination = (leave?.destination as string) ?? "";
  const studentName = (user?.fullName as string) ?? "—";
  const rollNumber = (student?.rollNumber as string) ?? "—";
  const email = (user?.email as string) ?? "";
  const phone = (user?.phone as string) ?? "";
  const isActive = (leave?.isActive as boolean) ?? false;
  const currentStepKey = (leave?.currentStepKey as string) ?? "";

  const attendance = (student?.attendance as number) ?? null;

  const policyResult = (leave?.policyResult as { checks?: Array<{ key: string; label: string; passed: boolean; message?: string }>; restrictions?: string[] } | null) ?? null;

  // ── UI state ──
  const [activeTab, setActiveTab] = useState("overview");
  const [actionTarget, setActionTarget] = useState<"approve" | "reject" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [comments, setComments] = useState("");
  const [rejectionCategory, setRejectionCategory] = useState("");
  const [needsResubmission, setNeedsResubmission] = useState(false);
  const [notifyParent, setNotifyParent] = useState(true);
  const [notifyStudent, setNotifyStudent] = useState(true);
  const [documentsVerified, setDocumentsVerified] = useState(false);
  const [ccEmailsInput, setCcEmailsInput] = useState("");

  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideMode, setOverrideMode] = useState<"ONE_STEP" | "ALL">("ONE_STEP");
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideError, setOverrideError] = useState("");
  const [overrideComments, setOverrideComments] = useState("");
  const [parentOverrideOpen, setParentOverrideOpen] = useState(false);

  // ── Computed data ──
  const sortedApprovals = useMemo(() => {
    if (!approvals) return [];
    return [...approvals]
      .sort((a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0))
      .map((app) => ({
        ...app,
        decision: app.decision?.toLowerCase() ?? "pending",
      })) as LeaveApproval[];
  }, [approvals]);

  const parentApproval = useMemo(
    () => sortedApprovals.find((a) => a.stepKey?.toLowerCase().includes("parent")),
    [sortedApprovals],
  );

  const currentApproval = useMemo(
    () => sortedApprovals.find((a) => a.decision === "pending"),
    [sortedApprovals],
  );

  // The leave's action buttons are only for the approver of the CURRENT step.
  // A POC who already approved (workflow moved to ADMIN) must no longer see
  // Approve/Reject — the page should show the new waiting state instead.
  const viewerCanAct = useMemo(() => {
    if (!isPending || !currentApproval) return false;
    const requiredRole = currentApproval.approverRoleCode;
    if (!requiredRole) return false;
    if (viewerRole === "SUPER_ADMIN") return requiredRole === "ADMIN" || requiredRole === "SUPER_ADMIN";
    if (viewerRole === "POC") return requiredRole === "POC";
    if (viewerRole === "ADMIN") return requiredRole === "ADMIN";
    return false;
  }, [isPending, currentApproval, viewerRole]);

  // Did this viewer already approve/reject this request in an earlier step?
  const viewerAlreadyActed = useMemo(
    () => sortedApprovals.some(
      (a) => a.approverRoleCode === viewerRole && (a.decision === "approved" || a.decision === "rejected" || a.decision === "auto_approved"),
    ),
    [sortedApprovals, viewerRole],
  );

  const allApproved = useMemo(
    () => sortedApprovals.length > 0 && sortedApprovals.every((a) => a.decision === "approved" || a.decision === "auto_approved"),
    [sortedApprovals],
  );

  const [now] = useState(() => Date.now());

  const hoursSinceCreation = useMemo(
    () => createdAt ? Math.floor((now - new Date(createdAt).getTime()) / 3600000) : null,
    [createdAt, now],
  );

  const hasParentApproval = !!parentApproval;
  const parentApproved = parentApproval?.decision === "approved";
  const parentRejected = parentApproval?.decision === "rejected";
  const parentPending = hasParentApproval && parentApproval?.decision === "pending";

  // Student stats
  const studentStatApproved = studentLeaves.filter((l: Record<string, unknown>) => l.status === LEAVE_REQUEST_STATUS.APPROVED).length;
  const studentStatRejected = studentLeaves.filter((l: Record<string, unknown>) => l.status === LEAVE_REQUEST_STATUS.REJECTED).length;
  const studentStatCancelled = studentLeaves.filter((l: Record<string, unknown>) => l.status === LEAVE_REQUEST_STATUS.CANCELLED).length;
  const studentStatPending = studentLeaves.filter((l: Record<string, unknown>) => l.status === LEAVE_REQUEST_STATUS.PENDING).length;

  // ── Actions ──
  const handleAction = useCallback(async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (actionTarget === "approve") {
        const ccEmails = ccEmailsInput
          .split(",")
          .map((email) => email.trim())
          .filter((email) => email.length > 0);
        const result = await approveLeave(leaveId, comments || undefined, undefined, isSpecialLeave ? documentsVerified : undefined, ccEmails.length > 0 ? ccEmails : undefined);
        if ((result as { requiresConfirmation?: boolean })?.requiresConfirmation) {
          // Parent approval is still pending — ask for override confirmation.
          setActionTarget(null);
          setParentOverrideOpen(true);
          return;
        }
        toast.success("Leave approved successfully");
      } else {
        await rejectLeave(leaveId, comments || undefined, undefined, rejectionCategory || undefined);
        toast.success("Leave rejected");
      }
      setActionTarget(null);
      setComments("");
      setRejectionCategory("");
      setNeedsResubmission(false);
      setNotifyParent(true);
      setNotifyStudent(true);
      setDocumentsVerified(false);
      setCcEmailsInput("");
      await Promise.all([leaveMutate(), chainMutate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  }, [actionTarget, comments, rejectionCategory, leaveId, leaveMutate, chainMutate, documentsVerified, isSpecialLeave, ccEmailsInput]);

  const handleOverride = useCallback(async () => {
    setOverrideLoading(true);
    setOverrideError("");
    try {
      await superadminOverrideLeave(leaveId, overrideMode, overrideComments || undefined);
      toast.success(`Leave ${overrideMode === "ONE_STEP" ? "advanced one step" : "fully approved"}`);
      setOverrideOpen(false);
      setOverrideComments("");
      await Promise.all([leaveMutate(), chainMutate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Override failed";
      setOverrideError(message);
    } finally {
      setOverrideLoading(false);
    }
  }, [leaveId, overrideMode, overrideComments, leaveMutate, chainMutate]);

  const confirmParentOverride = useCallback(async () => {
    setActionLoading(true);
    setActionError("");
    try {
      await approveLeave(
        leaveId,
        comments || undefined,
        undefined,
        isSpecialLeave ? documentsVerified : undefined,
        undefined,
        true,
      );
      toast.success("Leave approved successfully");
      setParentOverrideOpen(false);
      setComments("");
      setDocumentsVerified(false);
      await Promise.all([leaveMutate(), chainMutate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Override failed";
      setActionError(message);
    } finally {
      setActionLoading(false);
    }
  }, [leaveId, comments, documentsVerified, isSpecialLeave, leaveMutate, chainMutate]);

  // ── Early returns ──
  if (isLoading) return <LoadingState count={6} />;
  if (isError) {
    return (
      <ErrorState
        message="Failed to load leave details"
        onRetry={() => {
          leaveMutate();
          chainMutate();
        }}
      />
    );
  }
  if (!leave) return <ErrorState message="Leave not found" />;

  // ── Render ──
  return (
    <div className="space-y-6">
      {/* ════════════ HEADER ════════════ */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="icon" onClick={onBack} className="mt-0.5 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-mono text-h3 font-semibold tracking-tight">{requestNumber}</h1>
              <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
              {createdAt && (
                <span className="flex items-center gap-1 text-body text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {getTimeWaiting(createdAt)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted">
              <LeaveTypeBadge
                name={leaveTypeName ?? "—"}
                color={(leaveTypeUiConfig.color as string | undefined) ?? null}
              />
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(startAt)} → {formatDate(endAt)}
              </span>
              <span className="rounded-md bg-surface-sunken px-2 py-0.5 text-caption font-medium">
                {getDurationLabel(startAt, endAt)}
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { leaveMutate(); chainMutate(); }} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* ════════════ DECISION SUMMARY BANNER ════════════ */}
      {isPending && (
        <div
          className={cn(
            "rounded-xl border p-4 transition-all",
            parentPending
              ? "border-warning bg-warning-light dark:border-warning/30"
              : "border-success bg-success-light dark:border-success/30",
          )}
        >
          {parentPending ? (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning-light">
                <AlertTriangle className="h-4 w-4 text-warning" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-warning">⚠ Attention Required</p>
                <div className="mt-2 space-y-1 text-body text-warning">
                  <p className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Parent approval still pending
                  </p>
                  {attendance !== null && attendance < 75 && (
                    <p className="flex items-center gap-2">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Attendance: {attendance}%
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-light">
                <CheckCircle2 className="h-4 w-4 text-success" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-body font-semibold text-success">🟢 Ready for Approval</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-body text-success">
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    {hasParentApproval && parentApproved ? "Parent Approved" : "No Parent Required"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    Policy Validation Passed
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    No Overlapping Leaves
                  </span>
                </div>
                <p className="mt-2 text-caption text-success">
                  Waiting for: <span className="font-semibold">{currentApproval?.stepKey?.replace(/_/g, " ") ?? "Your"} Approval</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════ TWO-COLUMN LAYOUT ════════════ */}
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* ──────── LEFT COLUMN ──────── */}
        <div className="min-w-0 space-y-5">
          {/* Navigation Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start overflow-x-auto rounded-lg bg-surface-sunken/50 p-1">
              {TAB_CONFIG.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 text-caption data-[state=active]:bg-background"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ▸ OVERVIEW TAB */}
            <TabsContent value="overview" className="mt-5 space-y-5">
              {/* Student Profile */}
              <SectionCard title="Student Profile" Icon={User}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-4 sm:flex-col sm:items-center">
                    <Avatar name={studentName} size="xl" />
                    <div className="sm:text-center">
                      <p className="font-semibold">{studentName}</p>
                      <p className="text-caption text-muted">{rollNumber}</p>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-x-6 gap-y-2 text-body sm:grid-cols-2">
                    {email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <a href={`mailto:${email}`} className="truncate text-muted hover:text-foreground hover:underline">
                          {email}
                        </a>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <a href={`tel:${phone}`} className="text-muted hover:text-foreground hover:underline">
                          {phone}
                        </a>
                      </div>
                    )}
                    {destination && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted" />
                        <span className="text-muted">{destination}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 shrink-0 text-muted" />
                      <span className={cn("capitalize", status === "active" ? "text-success" : "text-muted")}>
                        {status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-4 grid grid-cols-4 gap-3 rounded-lg border border-border bg-surface-sunken/30 p-3">
                  <StatBadge label="Approved" value={studentStatApproved} variant="success" />
                  <StatBadge label="Pending" value={studentStatPending} variant="warning" />
                  <StatBadge label="Rejected" value={studentStatRejected} variant="danger" />
                  <StatBadge label="Cancelled" value={studentStatCancelled} variant="default" />
                </div>
              </SectionCard>

              {/* Leave Details */}
              <SectionCard title="Leave Details" Icon={FileText}>
                <dl className="space-y-3">
                  <DetailRow label="Leave Type">
                    <span className="flex items-center gap-2">
                      <span className="rounded-sm border border-border bg-surface-sunken px-1.5 py-0.5 text-micro font-medium text-muted">
                        {leaveTypeCategory ?? "—"}
                      </span>
                      {leaveType}
                    </span>
                  </DetailRow>
                  <DetailRow label="Duration">{getDurationLabel(startAt, endAt)}</DetailRow>
                  {destination && <DetailRow label="Destination">{destination}</DetailRow>}
                  <DetailRow label="Period">
                    {formatDate(startAt)} → {formatDate(endAt)}
                  </DetailRow>
                  <DetailRow label="Applied">{createdAt ? formatRelative(createdAt) : "—"}</DetailRow>
                  <DetailRow label="Request #">
                    <span className="font-mono text-caption text-muted">{requestNumber}</span>
                  </DetailRow>
                </dl>

                {reason && reason !== "—" && (
                  <div className="mt-4 rounded-lg bg-surface-sunken/50 p-3">
                    <p className="mb-1 text-micro font-medium uppercase tracking-wider text-muted">Reason</p>
                    <p className="text-body leading-relaxed">{reason}</p>
                  </div>
                )}
              </SectionCard>

              {/* Policy Evaluation */}
              <SectionCard title="Policy Evaluation" Icon={Shield}>
                <div className="space-y-2">
                  {policyResult?.checks?.map((policy) => (
                    <div key={policy.key} className="flex items-center justify-between rounded-lg px-3 py-2 text-body transition-colors hover:bg-surface-sunken/50">
                      <span className="flex items-center gap-2.5">
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", policy.passed ? "bg-success-light" : "bg-danger-light")}>
                          {policy.passed ? (
                            <Check className="h-3 w-3 text-success" />
                          ) : (
                            <X className="h-3 w-3 text-danger" />
                          )}
                        </div>
                        <span>{policy.label}</span>
                        {policy.message && (
                          <span className="text-caption text-muted">— {policy.message}</span>
                        )}
                      </span>
                      <span className={cn("text-caption font-medium", policy.passed ? "text-success" : "text-danger")}>
                        {policy.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                  {(!policyResult?.checks || policyResult.checks.length === 0) && (
                    <p className="text-body text-muted">No policy checks configured for this leave type.</p>
                  )}
                  {hasParentApproval && (
                    <div className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-body transition-colors hover:bg-surface-sunken/50",
                      parentApproved ? "" : "bg-warning-light",
                    )}>
                      <span className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full",
                          parentApproved ? "bg-success-light" : parentRejected ? "bg-danger-light" : "bg-warning-light",
                        )}>
                          {parentApproved ? <Check className="h-3 w-3 text-success" /> : parentRejected ? <X className="h-3 w-3 text-danger" /> : <Clock className="h-3 w-3 text-warning" />}
                        </div>
                        Parent Approval
                      </span>
                      <span className={cn(
                        "text-caption font-medium",
                        parentApproved ? "text-success" : parentRejected ? "text-danger" : "text-warning",
                      )}>
                        {parentApproved ? "Approved" : parentRejected ? "Rejected" : "Pending"}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-caption text-muted">
                  {parentPending
                    ? "Parent approval is still pending — waiting for parent response."
                    : !policyResult
                      ? "Policy results unavailable."
                      : policyResult.restrictions?.length
                        ? `${policyResult.restrictions.length} policy violation(s) detected.`
                        : "No policy violations detected."}
                </p>
              </SectionCard>

              {/* Workflow Summary */}
              <SectionCard title="Approval Workflow" Icon={Users}>
                <div className="relative">
                  {sortedApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Clock className="mb-2 h-6 w-6 text-muted/50" />
                      <p className="text-body text-muted">No approval steps defined.</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {sortedApprovals.map((app, _idx) => {
                        const decision = (app.decision ?? "PENDING").toUpperCase();
                        const config = decisionPresentation(decision);
                        const Icon = config.Icon;
                        const _isLast = _idx === sortedApprovals.length - 1;
                        const isCurrent = decision === "pending";

                        return (
                          <div key={app.id} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                  TONE_MARKER[config.tone],
                                  isCurrent && "ring-2 ring-warning/20",
                                )}
                              >
                                <Icon className={cn("h-3.5 w-3.5", TONE_TEXT[config.tone])} />
                              </div>
                              {!_isLast && (
                                <div
                                  className={cn(
                                    "h-full w-0.5",
                                    decision === "approved" || decision === "auto_approved"
                                      ? "bg-success-light"
                                      : decision === "rejected" || decision === "cancelled"
                                      ? "bg-danger-light"
                                      : "bg-border",
                                  )}
                                />
                              )}
                            </div>

                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("text-body font-medium", isCurrent && "text-warning")}>
                                  {app.stepKey?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? `Step ${app.stepOrder}`}
                                </span>
                                <Badge tone={config.tone} size="sm">
                                  {config.label}
                                </Badge>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-caption text-muted">
                                {app.approverRoleCode && <span>{app.approverRoleCode}</span>}
                                {app.approverName && <span>· {app.approverName}</span>}
                                {app.createdAt && <span>· {formatRelative(app.createdAt)}</span>}
                              </div>
                              {app.comments && (
                                <div className="mt-1.5 rounded-lg bg-surface-sunken/50 px-3 py-1.5 text-caption text-muted">
                                  &ldquo;{app.comments}&rdquo;
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                      {allApproved && (
                        <div className="relative flex gap-3">
                          <div className="flex items-center">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-success/20 bg-success-light">
                              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            </div>
                          </div>
                          <div className="flex items-center py-1">
                            <span className="text-body font-medium text-success">Completed</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </SectionCard>
            </TabsContent>

            {/* ▸ WORKFLOW TAB */}
            <TabsContent value="workflow" className="mt-5">
              <SectionCard title="Approval Workflow" Icon={Users}>
                {sortedApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="mb-3 h-10 w-10 text-muted/50" />
                    <p className="text-body text-muted">No approval steps defined for this leave type.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Student Submitted (always first) */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-accent-light">
                          <User className="h-4 w-4 text-accent" />
                        </div>
                        <div className="h-full w-0.5 bg-border" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-body font-semibold">Student Submitted</p>
                        {createdAt && <p className="text-caption text-muted">{formatDateTime(createdAt)}</p>}
                      </div>
                    </div>

                    {/* Approval Steps */}
                    {sortedApprovals.map((app, _i) => {
                      const decision = (app.decision ?? "PENDING").toUpperCase();
                      const config = decisionPresentation(decision);
                      const Icon = config.Icon;
                      const isCurrent = decision === "pending";

                      return (
                        <div key={app.id} className="relative flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                TONE_MARKER[config.tone],
                                isCurrent && "ring-2 ring-warning/20",
                              )}
                            >
                              <Icon className={cn("h-4 w-4", TONE_TEXT[config.tone])} />
                            </div>
                            <div className={cn(
                              "h-full w-0.5",
                              isCurrent ? "bg-warning-light" :
                              decision === "approved" || decision === "auto_approved" ? "bg-success-light" :
                              "bg-border",
                            )} />
                          </div>

                          <div className={cn("min-w-0 flex-1 pb-6")}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("text-body font-semibold capitalize", isCurrent && "text-warning")}>
                                {app.stepKey?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? `Step ${app.stepOrder}`}
                              </span>
                              <Badge tone={config.tone}>
                                {isCurrent && isPending ? "Current" : config.label}
                              </Badge>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
                              <span className="font-medium">{app.approverRoleCode ?? "—"}</span>
                              {app.approverName && <span>· {app.approverName}</span>}
                              {app.createdAt && <span>· {formatDateTime(app.createdAt)}</span>}
                            </div>

                            {app.comments && (
                              <div className="mt-2 rounded-lg bg-surface-sunken/50 px-3 py-2 text-body">
                                <span className="text-caption font-medium text-muted">Comment:</span> {app.comments}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* Completed */}
                    {allApproved && (
                      <div className="relative flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-success/20 bg-success-light">
                            <CheckCircle2 className="h-4 w-4 text-success" />
                          </div>
                        </div>
                        <div className="flex items-center pb-0">
                          <span className="text-body font-semibold text-success">Completed</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* ▸ TIMELINE TAB */}
            <TabsContent value="timeline" className="mt-5">
              <SectionCard title="Activity Timeline" Icon={Clock}>
                {(() => {
                  const events: Array<{ id: string; type: string; label: string; timestamp: string; actor?: string }> = [];

                  // Build events from all available data
                  if (createdAt) {
                    events.push({
                      id: "submitted",
                      type: "submitted",
                      label: "Student submitted leave request",
                      timestamp: createdAt,
                    });
                  }

                  sortedApprovals.forEach((app) => {
                    if (!app.createdAt) return;
                    const decision = app.decision;
                    const label =
                      decision === "approved"
                        ? `Approved by ${app.approverName ?? app.approverRoleCode ?? "Unknown"}`
                        : decision === "rejected"
                        ? `Rejected by ${app.approverName ?? app.approverRoleCode ?? "Unknown"}`
                        : `Pending review — ${app.approverRoleCode ?? "Unknown"}`;
                    events.push({
                      id: `step-${app.id}`,
                      type: decision === "approved" ? "approved" : decision === "rejected" ? "rejected" : "comment",
                      label,
                      timestamp: app.createdAt,
                      actor: app.approverName ?? app.approverRoleCode ?? undefined,
                    });
                  });

                  // Movement events
                  (movements as Array<{ id: string; eventType: string; createdAt: string; location?: string }>).forEach((mov) => {
                    events.push({
                      id: `mov-${mov.id}`,
                      type: "movement",
                      label: mov.eventType?.replace(/_/g, " ").toLowerCase() ?? "Movement",
                      timestamp: mov.createdAt,
                    });
                  });

                  // Sort reverse chronological
                  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

                  if (events.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <Clock className="mb-3 h-10 w-10 text-muted/50" />
                        <p className="text-body text-muted">No activity recorded yet.</p>
                      </div>
                    );
                  }

                  // The marker takes its tone from the taxonomy, so a solid
                  // fill never ends up carrying a white icon it cannot show.
                  const eventConfig: Record<
                    string,
                    { icon: React.ElementType; tone: BadgeTone }
                  > = {
                    submitted: { icon: FileText, tone: "accent" },
                    approved: { icon: CheckCircle2, tone: "success" },
                    rejected: { icon: XCircle, tone: "danger" },
                    comment: { icon: MessageSquare, tone: "neutral" },
                    movement: { icon: MapPin, tone: "info" },
                  };

                  return (
                    <div className="relative">
                      {events.map((event, i) => {
                        const config =
                          eventConfig[event.type] ??
                          ({ icon: Clock, tone: "neutral" } as const);
                        const Icon = config.icon;
                        const _isLast = i === events.length - 1;

                        return (
                          <div key={event.id} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
                                  TONE_MARKER[config.tone],
                                )}
                              >
                                <Icon
                                  className={cn("h-3 w-3", TONE_TEXT[config.tone])}
                                />
                              </div>
                              {!_isLast && <div className="h-full w-0.5 bg-border" />}
                            </div>
                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <p className="text-body font-medium">{event.label}</p>
                              <p className="text-caption text-muted">
                                {formatDateTime(event.timestamp)}
                                {event.actor && <span> · by {event.actor}</span>}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </SectionCard>
            </TabsContent>

            {/* ▸ AUDIT TAB */}
            <TabsContent value="audit" className="mt-5">
              <SectionCard title="Audit Trail" Icon={History}>
                {auditLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted" />
                  </div>
                ) : !auditData?.data || auditData.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="mb-3 h-10 w-10 text-muted/50" />
                    <p className="text-body text-muted">No audit records yet.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {auditData.data
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((entry, i) => {
                        const _isLast = i === auditData.data.length - 1;
                        return (
                          <div key={entry.id} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-sunken">
                                <History className="h-3 w-3 text-muted" />
                              </div>
                              {!_isLast && <div className="h-full w-0.5 bg-border" />}
                            </div>
                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <p className="text-body font-medium capitalize">
                                {entry.action.replace(/_/g, " ").toLowerCase()}
                              </p>
                              <p className="text-caption text-muted">
                                {formatDateTime(entry.createdAt)}
                                {entry.actorUserId && <span> · by user {entry.actorUserId.slice(0, 8)}</span>}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* ▸ QUESTIONS TAB */}
            <TabsContent value="questions" className="mt-5">
              <AskAQuestionSection leaveId={leaveId} canAsk />
            </TabsContent>

            {/* ▸ DOCUMENTS TAB */}
            <TabsContent value="documents" className="mt-5">
              <SectionCard title="Attachments" Icon={FileText}>
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="mb-3 h-10 w-10 text-muted/50" />
                    <p className="text-body text-muted">No documents attached.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const DocIcon = getDocumentIcon(doc.mimeType, doc.fileName);
                      return (
                        <a
                          key={doc.id}
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-muted/30 hover:shadow-sm"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-sunken">
                            <DocIcon className="h-5 w-5 text-muted" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-body font-medium group-hover:text-foreground">{doc.fileName}</p>
                            <p className="text-caption text-muted">
                              {doc.mimeType ?? "Unknown type"}
                              {doc.fileSize && ` · ${(doc.fileSize / 1024).toFixed(1)} KB`}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" />
                        </a>
                      );
                    })}
                  </div>
                )}
              </SectionCard>
            </TabsContent>
          </Tabs>
        </div>

        {/* ──────── RIGHT SIDEBAR ──────── */}
        <div className="space-y-4">
          {/* Status Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-muted">
                <Info className="h-3.5 w-3.5" />
                Status Info
              </h3>
            </div>
            <div className="space-y-3 p-4 text-body">
              <div className="flex items-center justify-between">
                <span className="text-muted">Status</span>
                <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Current Step</span>
                <span className="font-medium">{currentStepKey?.replace(/_/g, " ") ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Current Approver</span>
                <span className="font-medium">{currentApproval?.approverRoleCode ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">SLA</span>
                <span className="flex items-center gap-1 font-medium text-warning">
                  <Clock className="h-3 w-3" />
                  {hoursSinceCreation !== null ? `${hoursSinceCreation}h` : "—"}
                </span>
              </div>
              {hasParentApproval && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Parent</span>
                  <span className={cn(
                    "flex items-center gap-1 font-medium",
                    parentApproved ? "text-success" : parentRejected ? "text-danger" : "text-warning",
                  )}>
                    <Users className="h-3 w-3" />
                    {parentApproved ? "Approved" : parentRejected ? "Rejected" : "Pending"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted">QR Status</span>
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  isActive ? "text-success" : "text-muted",
                )}>
                  <QrCode className="h-3 w-3" />
                  {isActive ? "Active" : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Policy</span>
                <span className="font-medium text-success">Passed</span>
              </div>
            </div>
          </div>

          {/* Actions Card — only visible when this leave is waiting on the viewer's step */}
          {isPending && currentApproval && viewerCanAct && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-muted">
                  <Send className="h-3.5 w-3.5" />
                  Actions
                </h3>
              </div>
              <div className="space-y-2.5 p-4">
                <Button
                  onClick={() => setActionTarget("approve")}
                  disabled={actionLoading}
                  className="w-full gap-2"
                  size="lg"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setActionTarget("reject")}
                  disabled={actionLoading}
                  className="w-full gap-2"
                  size="lg"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-caption">
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
                {canOverride && (
                  <div className="border-t border-border pt-2.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setOverrideOpen(true); setOverrideError(""); }}
                      className="w-full gap-1.5 text-caption text-warning hover:text-warning hover:bg-warning-light"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Override
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Waiting Card — leave is pending, but it is not this viewer's turn */}
          {isPending && currentApproval && !viewerCanAct && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  Waiting
                </h3>
              </div>
              <div className="space-y-2.5 p-4 text-body">
                <p className="text-muted">
                  This request is waiting on{" "}
                  <span className="font-medium text-foreground">
                    {(currentApproval.approverRoleCode ?? "next approver").replace(/_/g, " ")}
                  </span>{" "}
                  approval.
                </p>
                {viewerAlreadyActed && (
                  <p className="flex items-center gap-1.5 text-caption text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Your approval has been recorded.
                  </p>
                )}
                {canOverride && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setOverrideOpen(true); setOverrideError(""); }}
                    className="w-full gap-1.5 text-caption text-warning hover:text-warning hover:bg-warning-light"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Override
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Leave Summary Mini Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-caption font-semibold uppercase tracking-wider text-muted">
                <Calendar className="h-3.5 w-3.5" />
                Summary
              </h3>
            </div>
            <div className="space-y-2.5 p-4 text-body">
              <div className="flex items-center justify-between">
                <span className="text-muted">Type</span>
                <span className="font-medium">{leaveType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Duration</span>
                <span className="font-medium">{getDurationLabel(startAt, endAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Student</span>
                <span className="max-w-[140px] truncate font-medium" title={studentName}>
                  {studentName}
                </span>
              </div>
              {attendance !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted">Attendance</span>
                  <span className={cn("font-medium tabular-nums", attendance < 75 ? "text-danger" : "text-success")}>
                    {attendance}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ════════════ APPROVE DIALOG ════════════ */}
      <AlertDialog open={actionTarget === "approve"} onOpenChange={() => setActionTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success-light">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Approve Leave</AlertDialogTitle>
                <AlertDialogDescription>
                  This will approve {requestNumber} for {studentName}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Comment <span className="text-muted/50">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add a note about your approval..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-body outline-none transition-colors placeholder:text-muted/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            {!isPocViewer && (
              <div>
                <label className="mb-1.5 block text-body font-medium text-muted">
                  CC recipients <span className="text-muted/50">(optional)</span>
                </label>
                <input
                  type="text"
                  value={ccEmailsInput}
                  onChange={(e) => setCcEmailsInput(e.target.value)}
                  placeholder="name@example.com, another@example.com"
                  className="w-full rounded-lg border border-input bg-background p-2.5 text-body outline-none transition-colors placeholder:text-muted/50 focus:border-ring focus:ring-1 focus:ring-ring"
                />
                <p className="mt-1 text-caption text-muted">
                  These addresses will be CC&apos;d on the approval email sent to the student.
                </p>
              </div>
            )}

            <div className="space-y-2.5 rounded-lg border border-border bg-surface-sunken/30 p-3">
              {!isPocViewer && (
                <>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyStudent}
                      onChange={(e) => setNotifyStudent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-body">Notify student</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyParent}
                      onChange={(e) => setNotifyParent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-body">Notify parent</span>
                  </label>
                </>
              )}
              {isSpecialLeave && (
                <label className="flex items-start gap-3 rounded-md border border-warning bg-warning-light p-3 dark:border-warning dark:bg-warning">
                  <input
                    type="checkbox"
                    checked={documentsVerified}
                    onChange={(e) => setDocumentsVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input text-warning focus:ring-warning"
                  />
                  <span className="text-body">
                    <strong>I confirm that the documents have been verified</strong>
                    <p className="mt-0.5 text-caption text-muted">
                      This leave type requires document verification before approval.
                    </p>
                  </span>
                </label>
              )}
            </div>

            {actionError && (
              <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
                {actionError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button onClick={handleAction} disabled={actionLoading} className="gap-2 bg-success hover:bg-success">
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════ PARENT OVERRIDE DIALOG ════════════ */}
      <AlertDialog open={parentOverrideOpen} onOpenChange={setParentOverrideOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Parent approval pending</AlertDialogTitle>
                <AlertDialogDescription>
                  Parent approval is still pending for {studentName}. Approving now will override the parent
                  approval process.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          {actionError && (
            <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
              {actionError}
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button
              onClick={confirmParentOverride}
              disabled={actionLoading}
              className="gap-2 bg-warning hover:bg-warning"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Anyway
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════ REJECT DIALOG ════════════ */}
      <AlertDialog open={actionTarget === "reject"} onOpenChange={() => setActionTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger-light">
                <XCircle className="h-5 w-5 text-danger" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Reject Leave</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reject {requestNumber} for {studentName}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Category <span className="text-destructive">*</span>
              </label>
              <Select value={rejectionCategory} onValueChange={setRejectionCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason category" />
                </SelectTrigger>
                <SelectContent>
                  {REJECTION_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Explain why this leave is being rejected..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-body outline-none transition-colors placeholder:text-muted/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-2.5 rounded-lg border border-border bg-surface-sunken/30 p-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={needsResubmission}
                  onChange={(e) => setNeedsResubmission(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-body font-medium">Needs resubmission</span>
                  <p className="text-caption text-muted">Allow student to reapply with corrections</p>
                </div>
              </label>
              {!isPocViewer && (
                <>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyStudent}
                      onChange={(e) => setNotifyStudent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-body">Notify student</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={notifyParent}
                      onChange={(e) => setNotifyParent(e.target.checked)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                    />
                    <span className="text-body">Notify parent</span>
                  </label>
                </>
              )}
            </div>

            {actionError && (
              <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
                {actionError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleAction}
              disabled={actionLoading || !rejectionCategory || !comments.trim()}
              className="gap-2"
            >
              {actionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  Reject
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ════════════ OVERRIDE DIALOG ════════════ */}
      <AlertDialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-light">
                <ShieldAlert className="h-5 w-5 text-warning" />
              </div>
              <div>
                <AlertDialogTitle className="text-h3">Override Approval</AlertDialogTitle>
                <AlertDialogDescription>
                  Force-advance this leave request through the approval workflow.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Override Mode
              </label>
              <Select value={overrideMode} onValueChange={(v) => setOverrideMode(v as "ONE_STEP" | "ALL")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ONE_STEP">Advance One Step</SelectItem>
                  <SelectItem value="ALL">Approve All (Finalize)</SelectItem>
                </SelectContent>
              </Select>
              <p className="mt-1.5 text-caption text-muted">
                {overrideMode === "ONE_STEP"
                  ? "Advances the leave to the next approval step. Workflow continues normally."
                  : "Approves all pending steps and finalizes the leave. This is irreversible."}
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-body font-medium text-muted">
                Comment <span className="text-muted/50">(optional)</span>
              </label>
              <textarea
                value={overrideComments}
                onChange={(e) => setOverrideComments(e.target.value)}
                placeholder="Reason for override..."
                rows={2}
                className="w-full rounded-lg border border-input bg-background p-3 text-body outline-none transition-colors placeholder:text-muted/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            {overrideError && (
              <div className="rounded-lg bg-danger-light p-3 text-body text-danger">
                {overrideError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={overrideLoading}>Cancel</AlertDialogCancel>
            <Button
              variant="default"
              onClick={handleOverride}
              disabled={overrideLoading}
              className="gap-2 bg-warning hover:bg-warning"
            >
              {overrideLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  {overrideMode === "ONE_STEP" ? "Advance One Step" : "Approve All"}
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Error banner */}
      {actionError && actionTarget === null && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-body text-destructive shadow-lg">
          <AlertCircle className="h-4 w-4" />
          {actionError}
          <Button variant="ghost" size="icon-xs" onClick={() => setActionError("")} className="ml-2">
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}
