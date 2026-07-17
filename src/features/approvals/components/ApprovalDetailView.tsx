"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  History,
  Loader2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Shield,
  User,
  Users,
  X,
  XCircle,
  Eye,
  File,
  Image,
  FileSpreadsheet,
  FileArchive,
  ExternalLink,
  AlertTriangle,
  Info,
  Send,
  Ban,
} from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { toast } from "sonner";
import useSWR from "swr";

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
import { ErrorState } from "@/components/shared/ErrorState";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { LoadingState } from "@/components/shared/LoadingState";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { useDocuments } from "@/hooks/use-documents";
import { useMovement } from "@/hooks/use-movement";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { CATEGORY_COLORS } from "@/constants/leave/leave-category";
import { approveLeave, rejectLeave } from "@/lib/api/approval-api";
import { getLeaveUrl } from "@/lib/api/leave-api";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────

type ApprovalDetailViewProps = {
  leaveId: string;
  onBack: () => void;
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

type NotificationItem = {
  id: string;
  eventType: string;
  channel: string;
  deliveryStatus: string;
  readAt: string | null;
  createdAt: string;
  leaveRequestId: string | null;
  metadata: Record<string, unknown> | null;
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

const STATUS_CONFIG = {
  approved: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    lightBg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-500",
    label: "Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-500",
    lightBg: "bg-red-50 dark:bg-red-500/10",
    border: "border-red-500",
    label: "Rejected",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-500",
    lightBg: "bg-amber-50 dark:bg-amber-500/10",
    border: "border-amber-500",
    label: "Pending",
  },
  cancelled: {
    icon: XCircle,
    color: "text-gray-500",
    bg: "bg-gray-500",
    lightBg: "bg-gray-50 dark:bg-gray-500/10",
    border: "border-gray-500",
    label: "Cancelled",
  },
  completed: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    lightBg: "bg-emerald-50 dark:bg-emerald-500/10",
    border: "border-emerald-500",
    label: "Completed",
  },
  active: {
    icon: Clock,
    color: "text-blue-600",
    bg: "bg-blue-500",
    lightBg: "bg-blue-50 dark:bg-blue-500/10",
    border: "border-blue-500",
    label: "Active",
  },
};

const DECISION_CONFIG = {
  approved: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-500",
    lightBg: "bg-emerald-500/10",
    label: "Approved",
  },
  auto_approved: {
    icon: CheckCircle2,
    color: "text-blue-600",
    bg: "bg-blue-500",
    lightBg: "bg-blue-500/10",
    label: "Auto Approved",
  },
  rejected: {
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-500",
    lightBg: "bg-red-500/10",
    label: "Rejected",
  },
  cancelled: {
    icon: Ban,
    color: "text-gray-500",
    bg: "bg-gray-500",
    lightBg: "bg-gray-500/10",
    label: "Cancelled",
  },
  pending: {
    icon: Clock,
    color: "text-amber-600",
    bg: "bg-amber-500",
    lightBg: "bg-amber-500/10",
    label: "Pending",
  },
};

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
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "audit", label: "Audit", icon: History },
  { id: "documents", label: "Documents", icon: FileText },
];

const avatarColors = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  "bg-rose-500/10 text-rose-600 dark:text-rose-400",
];

// ─── Helpers ────────────────────────────────────────────────

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

function formatRelative(dateStr: string): string {
  try {
    return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
  } catch {
    return "—";
  }
}

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
    success: "text-emerald-600 bg-emerald-500/10",
    danger: "text-red-600 bg-red-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    default: "text-muted-foreground bg-muted",
  };
  return (
    <div className="text-center">
      <p className={cn("text-lg font-semibold tabular-nums", styles[variant].split(" ")[0])}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
  className,
  action,
}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-sm", className)}>
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <dt className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{children}</dd>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

export function ApprovalDetailView({ leaveId, onBack }: ApprovalDetailViewProps) {
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

  const { data: notifData, isLoading: notifLoading } = useSWR<{ data: { items: NotificationItem[]; total: number } }>(
    leaveId ? `/api/v1/notifications?page=1&limit=50` : null,
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
  const status = ((leave?.status as string) ?? "").toLowerCase() as keyof typeof STATUS_CONFIG;
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

  const allApproved = useMemo(
    () => sortedApprovals.length > 0 && sortedApprovals.every((a) => a.decision === "approved" || a.decision === "auto_approved"),
    [sortedApprovals],
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

  // Notification filter
  const leaveNotifications = useMemo(() => {
    const items = (notifData?.data?.items as NotificationItem[]) ?? [];
    return items.filter(
      (n) => n.leaveRequestId === leaveId || (n.metadata as Record<string, unknown> | null)?.leaveRequestId === leaveId,
    );
  }, [notifData, leaveId]);

  // ── Actions ──
  const handleAction = useCallback(async () => {
    if (!actionTarget) return;
    setActionLoading(true);
    setActionError("");
    try {
      if (actionTarget === "approve") {
        await approveLeave(leaveId, comments || undefined, undefined, isSpecialLeave ? documentsVerified : undefined);
        toast.success("Leave approved successfully");
      } else {
        await rejectLeave(leaveId, rejectionCategory ? `[${rejectionCategory}] ${comments}`.trim() : comments || undefined);
        toast.success("Leave rejected");
      }
      setActionTarget(null);
      setComments("");
      setRejectionCategory("");
      setNeedsResubmission(false);
      setNotifyParent(true);
      setNotifyStudent(true);
      setDocumentsVerified(false);
      await Promise.all([leaveMutate(), chainMutate()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setActionError(message);
      logger.error("Approval action failed", { error: message });
    } finally {
      setActionLoading(false);
    }
  }, [actionTarget, comments, rejectionCategory, leaveId, leaveMutate, chainMutate, documentsVerified, isSpecialLeave]);

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
              <h1 className="font-mono text-xl font-semibold tracking-tight">{requestNumber}</h1>
              <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
              {createdAt && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  {getTimeWaiting(createdAt)}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium text-foreground">
                <Calendar className="h-3.5 w-3.5" />
                {leaveType}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(startAt)} → {formatDate(endAt)}
              </span>
              <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">
                {getDuration(startAt, endAt)}
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
              ? "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/5"
              : "border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/5",
          )}
        >
          {parentPending ? (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚠ Attention Required</p>
                <div className="mt-2 space-y-1 text-sm text-amber-700 dark:text-amber-400">
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
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">🟢 Ready for Approval</p>
                <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-emerald-700 dark:text-emerald-400">
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
                <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
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
            <TabsList className="w-full justify-start overflow-x-auto rounded-lg bg-muted/50 p-1">
              {TAB_CONFIG.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1.5 text-xs data-[state=active]:bg-background"
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ▸ OVERVIEW TAB */}
            <TabsContent value="overview" className="mt-5 space-y-5">
              {/* Student Profile */}
              <SectionCard title="Student Profile" icon={User}>
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                  <div className="flex items-center gap-4 sm:flex-col sm:items-center">
                    <div
                      className={cn(
                        "flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-semibold shadow-sm ring-2 ring-background",
                        avatarColors[Math.abs(studentName.charCodeAt(0)) % avatarColors.length],
                      )}
                    >
                      {getInitials(studentName)}
                    </div>
                    <div className="sm:text-center">
                      <p className="font-semibold">{studentName}</p>
                      <p className="text-xs text-muted-foreground">{rollNumber}</p>
                    </div>
                  </div>

                  <div className="grid flex-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a href={`mailto:${email}`} className="truncate text-muted-foreground hover:text-foreground hover:underline">
                          {email}
                        </a>
                      </div>
                    )}
                    {phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <a href={`tel:${phone}`} className="text-muted-foreground hover:text-foreground hover:underline">
                          {phone}
                        </a>
                      </div>
                    )}
                    {destination && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">{destination}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Shield className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className={cn("capitalize", status === "active" ? "text-emerald-600" : "text-muted-foreground")}>
                        {status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="mt-4 grid grid-cols-4 gap-3 rounded-lg border border-border bg-muted/30 p-3">
                  <StatBadge label="Approved" value={studentStatApproved} variant="success" />
                  <StatBadge label="Pending" value={studentStatPending} variant="warning" />
                  <StatBadge label="Rejected" value={studentStatRejected} variant="danger" />
                  <StatBadge label="Cancelled" value={studentStatCancelled} variant="default" />
                </div>
              </SectionCard>

              {/* Leave Details */}
              <SectionCard title="Leave Details" icon={FileText}>
                <dl className="space-y-3">
                  <DetailRow label="Leave Type">
                    <span className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[leaveTypeCategory ?? ""] ?? "bg-muted text-muted-foreground"}`}>
                        {leaveTypeCategory ?? "—"}
                      </span>
                      {leaveType}
                    </span>
                  </DetailRow>
                  <DetailRow label="Duration">{getDuration(startAt, endAt)}</DetailRow>
                  {destination && <DetailRow label="Destination">{destination}</DetailRow>}
                  <DetailRow label="Period">
                    {formatDate(startAt)} → {formatDate(endAt)}
                  </DetailRow>
                  <DetailRow label="Applied">{createdAt ? formatRelative(createdAt) : "—"}</DetailRow>
                  <DetailRow label="Request #">
                    <span className="font-mono text-xs text-muted-foreground">{requestNumber}</span>
                  </DetailRow>
                </dl>

                {reason && reason !== "—" && (
                  <div className="mt-4 rounded-lg bg-muted/50 p-3">
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Reason</p>
                    <p className="text-sm leading-relaxed">{reason}</p>
                  </div>
                )}
              </SectionCard>

              {/* Policy Evaluation */}
              <SectionCard title="Policy Evaluation" icon={Shield}>
                <div className="space-y-2">
                  {policyResult?.checks?.map((policy) => (
                    <div key={policy.key} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50">
                      <span className="flex items-center gap-2.5">
                        <div className={cn("flex h-5 w-5 items-center justify-center rounded-full", policy.passed ? "bg-emerald-500/10" : "bg-red-500/10")}>
                          {policy.passed ? (
                            <Check className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <X className="h-3 w-3 text-red-500" />
                          )}
                        </div>
                        <span>{policy.label}</span>
                        {policy.message && (
                          <span className="text-xs text-muted-foreground">— {policy.message}</span>
                        )}
                      </span>
                      <span className={cn("text-xs font-medium", policy.passed ? "text-emerald-600" : "text-red-600")}>
                        {policy.passed ? "Passed" : "Failed"}
                      </span>
                    </div>
                  ))}
                  {(!policyResult?.checks || policyResult.checks.length === 0) && (
                    <p className="text-sm text-muted-foreground">No policy checks configured for this leave type.</p>
                  )}
                  {hasParentApproval && (
                    <div className={cn(
                      "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted/50",
                      parentApproved ? "" : "bg-amber-500/5",
                    )}>
                      <span className="flex items-center gap-2.5">
                        <div className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full",
                          parentApproved ? "bg-emerald-500/10" : parentRejected ? "bg-red-500/10" : "bg-amber-500/10",
                        )}>
                          {parentApproved ? <Check className="h-3 w-3 text-emerald-500" /> : parentRejected ? <X className="h-3 w-3 text-red-500" /> : <Clock className="h-3 w-3 text-amber-500" />}
                        </div>
                        Parent Approval
                      </span>
                      <span className={cn(
                        "text-xs font-medium",
                        parentApproved ? "text-emerald-600" : parentRejected ? "text-red-600" : "text-amber-600",
                      )}>
                        {parentApproved ? "Approved" : parentRejected ? "Rejected" : "Pending"}
                      </span>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
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
              <SectionCard title="Approval Workflow" icon={Users}>
                <div className="relative">
                  {sortedApprovals.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                      <Clock className="mb-2 h-6 w-6 text-muted-foreground/50" />
                      <p className="text-sm text-muted-foreground">No approval steps defined.</p>
                    </div>
                  ) : (
                    <div className="space-y-0">
                      {sortedApprovals.map((app, _idx) => {
                        const decision = app.decision as keyof typeof DECISION_CONFIG;
                        const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.pending;
                        const Icon = config.icon;
                        const _isLast = _idx === sortedApprovals.length - 1;
                        const isCurrent = decision === "pending";

                        return (
                          <div key={app.id} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div
                                className={cn(
                                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                  isCurrent
                                    ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                                    : decision === "approved" || decision === "auto_approved"
                                    ? "border-emerald-500 bg-emerald-500/10"
                                    : decision === "rejected" || decision === "cancelled"
                                    ? "border-red-500 bg-red-500/10"
                                    : "border-border bg-muted",
                                )}
                              >
                                <Icon className={cn("h-3.5 w-3.5", config.color)} />
                              </div>
                              {!_isLast && (
                                <div
                                  className={cn(
                                    "h-full w-0.5",
                                    decision === "approved" || decision === "auto_approved"
                                      ? "bg-emerald-200 dark:bg-emerald-800/50"
                                      : decision === "rejected" || decision === "cancelled"
                                      ? "bg-red-200 dark:bg-red-800/50"
                                      : "bg-border",
                                  )}
                                />
                              )}
                            </div>

                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={cn("text-sm font-medium", isCurrent && "text-amber-600 dark:text-amber-400")}>
                                  {app.stepKey?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? `Step ${app.stepOrder}`}
                                </span>
                                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", config.lightBg, config.color)}>
                                  {config.label}
                                </span>
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                                {app.approverRoleCode && <span>{app.approverRoleCode}</span>}
                                {app.approverName && <span>· {app.approverName}</span>}
                                {app.createdAt && <span>· {formatRelative(app.createdAt)}</span>}
                              </div>
                              {app.comments && (
                                <div className="mt-1.5 rounded-lg bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground">
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
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-emerald-500/20 bg-emerald-500/10">
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            </div>
                          </div>
                          <div className="flex items-center py-1">
                            <span className="text-sm font-medium text-emerald-600">Completed</span>
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
              <SectionCard title="Approval Workflow" icon={Users}>
                {sortedApprovals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No approval steps defined for this leave type.</p>
                  </div>
                ) : (
                  <div className="relative">
                    {/* Student Submitted (always first) */}
                    <div className="relative flex gap-4 pb-6">
                      <div className="flex flex-col items-center">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-blue-500 bg-blue-500/10">
                          <User className="h-4 w-4 text-blue-500" />
                        </div>
                        <div className="h-full w-0.5 bg-border" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold">Student Submitted</p>
                        {createdAt && <p className="text-xs text-muted-foreground">{formatDateTime(createdAt)}</p>}
                      </div>
                    </div>

                    {/* Approval Steps */}
                    {sortedApprovals.map((app, _i) => {
                      const decision = app.decision as keyof typeof DECISION_CONFIG;
                      const config = DECISION_CONFIG[decision] ?? DECISION_CONFIG.pending;
                      const Icon = config.icon;
                      const isCurrent = decision === "pending";

                      return (
                        <div key={app.id} className="relative flex gap-4">
                          <div className="flex flex-col items-center">
                            <div
                              className={cn(
                                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                                isCurrent
                                  ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                                  : decision === "approved" || decision === "auto_approved"
                                  ? "border-emerald-500 bg-emerald-500/10"
                                  : decision === "rejected" || decision === "cancelled"
                                  ? "border-red-500 bg-red-500/10"
                                  : "border-border bg-muted",
                              )}
                            >
                              <Icon className={cn("h-4 w-4", config.color)} />
                            </div>
                            <div className={cn(
                              "h-full w-0.5",
                              isCurrent ? "bg-amber-200 dark:bg-amber-800/50" :
                              decision === "approved" || decision === "auto_approved" ? "bg-emerald-200 dark:bg-emerald-800/50" :
                              "bg-border",
                            )} />
                          </div>

                          <div className={cn("min-w-0 flex-1 pb-6")}>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={cn("text-sm font-semibold capitalize", isCurrent && "text-amber-600")}>
                                {app.stepKey?.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) ?? `Step ${app.stepOrder}`}
                              </span>
                              <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", config.lightBg, config.color)}>
                                {isCurrent && isPending ? "● Current" : config.label}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                              <span className="font-medium">{app.approverRoleCode ?? "—"}</span>
                              {app.approverName && <span>· {app.approverName}</span>}
                              {app.createdAt && <span>· {formatDateTime(app.createdAt)}</span>}
                            </div>

                            {app.comments && (
                              <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                                <span className="text-xs font-medium text-muted-foreground">Comment:</span> {app.comments}
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
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/20 bg-emerald-500/10">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          </div>
                        </div>
                        <div className="flex items-center pb-0">
                          <span className="text-sm font-semibold text-emerald-600">Completed</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* ▸ TIMELINE TAB */}
            <TabsContent value="timeline" className="mt-5">
              <SectionCard title="Activity Timeline" icon={Clock}>
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
                        <Clock className="mb-3 h-10 w-10 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
                      </div>
                    );
                  }

                  const eventConfig: Record<string, { icon: React.ElementType; bg: string }> = {
                    submitted: { icon: FileText, bg: "bg-blue-500" },
                    approved: { icon: CheckCircle2, bg: "bg-emerald-500" },
                    rejected: { icon: XCircle, bg: "bg-red-500" },
                    comment: { icon: MessageSquare, bg: "bg-gray-500" },
                    movement: { icon: MapPin, bg: "bg-violet-500" },
                  };

                  return (
                    <div className="relative">
                      {events.map((event, i) => {
                        const config = eventConfig[event.type] ?? { icon: Clock, bg: "bg-gray-500" };
                        const Icon = config.icon;
                        const _isLast = i === events.length - 1;

                        return (
                          <div key={event.id} className="relative flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full", config.bg)}>
                                <Icon className="h-3 w-3 text-white" />
                              </div>
                              {!_isLast && <div className="h-full w-0.5 bg-border" />}
                            </div>
                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <p className="text-sm font-medium">{event.label}</p>
                              <p className="text-xs text-muted-foreground">
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

            {/* ▸ NOTIFICATIONS TAB */}
            <TabsContent value="notifications" className="mt-5">
              <SectionCard title="Notifications" icon={Bell}>
                {notifLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leaveNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Bell className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No notifications sent for this leave request.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {leaveNotifications.map((n) => (
                      <div key={n.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/30">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            n.deliveryStatus === "SENT"
                              ? "bg-emerald-500/10 text-emerald-500"
                              : n.deliveryStatus === "FAILED"
                              ? "bg-red-500/10 text-red-500"
                              : "bg-muted text-muted-foreground",
                          )}
                        >
                          {n.deliveryStatus === "SENT" ? <Check className="h-4 w-4" /> : n.deliveryStatus === "FAILED" ? <X className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium capitalize">
                            {n.eventType.replace(/_/g, " ").toLowerCase()}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="capitalize">via {n.channel.toLowerCase()}</span>
                            <span>· {formatRelative(n.createdAt)}</span>
                            {n.deliveryStatus === "FAILED" && (
                              <span className="text-red-500">Failed</span>
                            )}
                          </div>
                        </div>
                        {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            {/* ▸ AUDIT TAB */}
            <TabsContent value="audit" className="mt-5">
              <SectionCard title="Audit Trail" icon={History}>
                {auditLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : !auditData?.data || auditData.data.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No audit records yet.</p>
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
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted">
                                <History className="h-3 w-3 text-muted-foreground" />
                              </div>
                              {!_isLast && <div className="h-full w-0.5 bg-border" />}
                            </div>
                            <div className={cn("min-w-0 flex-1 pb-4", _isLast && "pb-0")}>
                              <p className="text-sm font-medium capitalize">
                                {entry.action.replace(/_/g, " ").toLowerCase()}
                              </p>
                              <p className="text-xs text-muted-foreground">
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

            {/* ▸ DOCUMENTS TAB */}
            <TabsContent value="documents" className="mt-5">
              <SectionCard title="Attachments" icon={FileText}>
                {documents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="mb-3 h-10 w-10 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">No documents attached.</p>
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
                          className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:border-muted-foreground/30 hover:shadow-sm"
                        >
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                            <DocIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium group-hover:text-foreground">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.mimeType ?? "Unknown type"}
                              {doc.fileSize && ` · ${(doc.fileSize / 1024).toFixed(1)} KB`}
                            </p>
                          </div>
                          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
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
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Info className="h-3.5 w-3.5" />
                Status Info
              </h3>
            </div>
            <div className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <StatusBadge status={status as "approved" | "pending" | "rejected" | "active"} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Step</span>
                <span className="font-medium">{currentStepKey?.replace(/_/g, " ") ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Current Approver</span>
                <span className="font-medium">{currentApproval?.approverRoleCode ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SLA</span>
                <span className="flex items-center gap-1 font-medium text-amber-600">
                  <Clock className="h-3 w-3" />
                  {createdAt ? `${Math.floor((Date.now() - new Date(createdAt).getTime()) / 3600000)}h` : "—"}
                </span>
              </div>
              {hasParentApproval && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Parent</span>
                  <span className={cn(
                    "flex items-center gap-1 font-medium",
                    parentApproved ? "text-emerald-600" : parentRejected ? "text-red-600" : "text-amber-600",
                  )}>
                    <Users className="h-3 w-3" />
                    {parentApproved ? "Approved" : parentRejected ? "Rejected" : "Pending"}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">QR Status</span>
                <span className={cn(
                  "flex items-center gap-1 font-medium",
                  isActive ? "text-emerald-600" : "text-muted-foreground",
                )}>
                  <QrCode className="h-3 w-3" />
                  {isActive ? "Active" : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Policy</span>
                <span className="font-medium text-emerald-600">Passed</span>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          {isPending && (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              <div className="border-b border-border px-4 py-3">
                <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                  <Download className="h-3.5 w-3.5" />
                  Download PDF
                </Button>
              </div>
            </div>
          )}

          {/* Leave Summary Mini Card */}
          <div className="rounded-xl border border-border bg-card shadow-sm">
            <div className="border-b border-border px-4 py-3">
              <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                Summary
              </h3>
            </div>
            <div className="space-y-2.5 p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium">{leaveType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Duration</span>
                <span className="font-medium">{getDuration(startAt, endAt)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Student</span>
                <span className="max-w-[140px] truncate font-medium" title={studentName}>
                  {studentName}
                </span>
              </div>
              {attendance !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Attendance</span>
                  <span className={cn("font-medium tabular-nums", attendance < 75 ? "text-red-600" : "text-emerald-600")}>
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
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">Approve Leave</AlertDialogTitle>
                <AlertDialogDescription>
                  This will approve {requestNumber} for {studentName}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Comment <span className="text-muted-foreground/50">(optional)</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add a note about your approval..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyStudent}
                  onChange={(e) => setNotifyStudent(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm">Notify student</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyParent}
                  onChange={(e) => setNotifyParent(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm">Notify parent</span>
              </label>
              {isSpecialLeave && (
                <label className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
                  <input
                    type="checkbox"
                    checked={documentsVerified}
                    onChange={(e) => setDocumentsVerified(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input text-amber-600 focus:ring-amber-500"
                  />
                  <span className="text-sm">
                    <strong>I confirm that the documents have been verified</strong>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      This leave type requires document verification before approval.
                    </p>
                  </span>
                </label>
              )}
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
                {actionError}
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancel</AlertDialogCancel>
            <Button onClick={handleAction} disabled={actionLoading} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
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

      {/* ════════════ REJECT DIALOG ════════════ */}
      <AlertDialog open={actionTarget === "reject"} onOpenChange={() => setActionTarget(null)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <AlertDialogTitle className="text-lg">Reject Leave</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reject {requestNumber} for {studentName}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
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
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Reason <span className="text-destructive">*</span>
              </label>
              <textarea
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Explain why this leave is being rejected..."
                rows={3}
                className="w-full rounded-lg border border-input bg-background p-3 text-sm outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="space-y-2.5 rounded-lg border border-border bg-muted/30 p-3">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={needsResubmission}
                  onChange={(e) => setNeedsResubmission(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <div>
                  <span className="text-sm font-medium">Needs resubmission</span>
                  <p className="text-xs text-muted-foreground">Allow student to reapply with corrections</p>
                </div>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyStudent}
                  onChange={(e) => setNotifyStudent(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm">Notify student</span>
              </label>
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={notifyParent}
                  onChange={(e) => setNotifyParent(e.target.checked)}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                />
                <span className="text-sm">Notify parent</span>
              </label>
            </div>

            {actionError && (
              <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-400">
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

      {/* Error banner */}
      {actionError && actionTarget === null && (
        <div className="fixed bottom-4 right-4 flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive shadow-lg">
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
