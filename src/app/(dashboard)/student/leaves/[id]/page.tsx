"use client";

import { format, formatDistanceToNow, parseISO } from "date-fns";
import {
  ArrowLeft,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  History,
  Loader2,
  LogIn,
  LogOut,
  Mail,
  MapPin,
  Phone,
  QrCode,
  RefreshCw,
  RotateCcw,
  Shield,
  Upload,
  User,
  Users,
  XCircle,
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { ConfirmationDialog } from "@/components/shared/ConfirmationDialog";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { useApprovalChain } from "@/features/approvals/hooks/use-approval-chain";
import { ExtensionForm } from "@/features/extensions/components/ExtensionForm";
import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";
import { DocumentList } from "@/features/leaves/components/DocumentList";
import { DocumentUpload } from "@/features/leaves/components/DocumentUpload";
import { useLeave } from "@/features/leaves/hooks/use-leaves";
import {
  type NotificationItem,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { useMovement } from "@/hooks/use-movement";
import { useQrToken } from "@/hooks/use-qr-token";
import { cancelLeave } from "@/lib/api/leave-api";
import { generateQr } from "@/lib/api/movement-api";
import { cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr.split("T")[0] ?? "—";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const avatarColors = [
  "bg-blue-500/10 text-blue-600",
  "bg-emerald-500/10 text-emerald-600",
  "bg-violet-500/10 text-violet-600",
  "bg-amber-500/10 text-amber-600",
  "bg-rose-500/10 text-rose-600",
];

function StatusChip({
  variant,
  children,
}: {
  variant: "success" | "warning" | "error" | "muted";
  children: React.ReactNode;
}) {
  const styles = {
    success:
      "border-emerald-500/30 bg-emerald-500/5 text-emerald-600",
    warning:
      "border-amber-500/30 bg-amber-500/5 text-amber-600",
    error: "border-red-500/30 bg-red-500/5 text-red-600",
    muted:
      "border-muted-foreground/30 bg-muted/30 text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        styles[variant],
      )}
    >
      {children}
    </span>
  );
}

// ─── Section Components ─────────────────────────────────────

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
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md",
        className,
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function ApprovalTimeline({ leaveId, leaveStatus }: { leaveId: string; leaveStatus: string }) {
  const { approvals, isLoading, isError } = useApprovalChain(leaveId);

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError)
    return (
      <p className="py-4 text-center text-sm text-destructive">
        Failed to load approvals
      </p>
    );
  if (approvals.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No approvals recorded yet
        </p>
      </div>
    );

  const sorted = [...approvals].sort(
    (a, b) => (a.stepOrder ?? 0) - (b.stepOrder ?? 0),
  );
  const allApproved = sorted.every(
    (a) => a.decision?.toLowerCase() === "approved",
  );

  return (
    <div className="relative">
      {sorted.map((app, i) => {
        const decision = (app.decision ?? "pending").toLowerCase();
        const isLast = i === sorted.length - 1;
        const isPending = decision === "pending";
        const isCancelled = decision === "cancelled"
          || decision === "pending" && leaveStatus === "cancelled";
        const isApproved = decision === "approved" || decision === "APPROVED";
        const isRejected = decision === "rejected" || decision === "REJECTED";

        return (
          <div key={app.id} className="relative flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                  isApproved
                    ? "border-emerald-500 bg-emerald-500/10"
                    : isRejected
                      ? "border-red-500 bg-red-500/10"
                      : isCancelled
                        ? "border-muted-foreground/30 bg-muted/30"
                        : isPending
                          ? "border-amber-500 bg-amber-500/10"
                          : "border-border bg-muted",
                )}
              >
                {isApproved && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {isRejected && <XCircle className="h-4 w-4 text-red-500" />}
                {isCancelled && <XCircle className="h-4 w-4 text-muted-foreground" />}
                {isPending && <Clock className="h-4 w-4 text-amber-500" />}
              </div>
              {!isLast && <div className="h-full w-px bg-border" />}
            </div>

            <div className={cn("min-w-0 flex-1 pb-8", isLast && "pb-0")}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold capitalize">
                  {app.stepKey?.replace(/_/g, " ") ?? `Step ${app.stepOrder}`}
                </span>
                <StatusChip
                  variant={
                    isApproved
                      ? "success"
                      : isRejected
                        ? "error"
                        : isCancelled
                          ? "muted"
                          : "warning"
                  }
                >
                  {isApproved
                    ? "Approved"
                    : isRejected
                      ? "Rejected"
                      : isCancelled
                        ? "Cancelled"
                        : "Pending"}
                </StatusChip>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                {app.approverRoleCode && (
                  <span className="font-medium">{app.approverRoleCode}</span>
                )}
                {app.approverName && <span>· {app.approverName}</span>}
                {app.createdAt && (
                  <span>· {formatRelative(app.createdAt)}</span>
                )}
              </div>

              {app.comments && (
                <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="text-xs font-medium text-muted-foreground">
                    Comments:
                  </span>{" "}
                  {app.comments}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {allApproved && (
        <div className="relative flex gap-4">
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/20 bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
          </div>
          <div className="flex items-center pb-0">
            <span className="text-sm font-medium text-emerald-600">
              Completed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function ParentApprovalSection({ leaveId }: { leaveId: string }) {
  const { approvals, isLoading } = useApprovalChain(leaveId);
  const parentApproval = approvals.find((a) =>
    a.stepKey?.toLowerCase().includes("parent"),
  );

  if (isLoading)
    return (
      <SectionCard title="Parent Approval" icon={Users}>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </SectionCard>
    );
  if (!parentApproval) return null;

  const decision = (parentApproval.decision ?? "").toLowerCase();
  const isApproved = decision === "approved";
  const isRejected = decision === "rejected";

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              isApproved
                ? "bg-emerald-500/10 text-emerald-500"
                : isRejected
                  ? "bg-red-500/10 text-red-500"
                  : "bg-amber-500/10 text-amber-500",
            )}
          >
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium">Parent Approval</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusChip
                variant={
                  isApproved
                    ? "success"
                    : isRejected
                      ? "error"
                      : "warning"
                }
              >
                {isApproved
                  ? "Approved"
                  : isRejected
                    ? "Rejected"
                    : "Pending"}
              </StatusChip>
            </div>
            {parentApproval.approverName && (
              <p className="mt-1 text-xs text-muted-foreground">
                By: {parentApproval.approverName}
              </p>
            )}
            {parentApproval.createdAt && (
              <p className="text-xs text-muted-foreground">
                {formatDateTime(parentApproval.createdAt)}
              </p>
            )}
          </div>
        </div>
        {parentApproval.comments && (
          <div className="max-w-[200px] rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            {parentApproval.comments}
          </div>
        )}
      </div>
    </div>
  );
}

function QRPassSection({
  leaveId,
  isApproved,
}: {
  leaveId: string;
  isApproved: boolean;
}) {
  const [generating, setGenerating] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [qrPasses, setQrPasses] = useState<
    Array<{
      id: string;
      status: string;
      qrType: string;
      expiresAt: string | null;
    }>
  >([]);
  const [fetchKey, setFetchKey] = useState(0);
  const { storeToken } = useQrToken();

  // Fetch QR passes — uses fetchKey to trigger re-fetches
  useEffect(() => {
    if (!isApproved) return;
    let cancelled = false;
    fetch(
      `/api/v1/movements/qr-passes?leaveRequestId=${leaveId}`,
    )
      .then((r) => r.json())
      .then((json) => {
        if (!cancelled && json.success && Array.isArray(json.data)) {
          setQrPasses(json.data);
          setQrError(null);
        }
      })
      .catch(() => {
        // endpoint may not exist yet — ok
      });
    return () => {
      cancelled = true;
    };
  }, [leaveId, isApproved, fetchKey]);

  const handleGenerate = async () => {
    if (!leaveId) return;
    setGenerating(true);
    setQrError(null);
    try {
      const result = (await generateQr(leaveId, "LEAVE_EXIT")) as {
        passId: string;
        token: string;
      } | null;
      if (result?.passId && result?.token) {
        storeToken(result.passId, result.token, leaveId);
        toast.success("QR pass generated");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (!msg.includes("already exists")) {
        toast.error(msg || "Failed to generate QR");
        setQrError(msg || "Failed to generate QR");
      }
    } finally {
      setGenerating(false);
      setFetchKey((k) => k + 1);
    }
  };

  return (
    <SectionCard title="QR Passes" icon={QrCode}>
      {qrPasses.length > 0 ? (
        <div className="space-y-3">
          {qrPasses.map((pass) => {
            const isActive = pass.status === "ACTIVE";
            const isUsed = pass.status === "USED";
            const isExitPass = pass.qrType === "LEAVE_EXIT";

            return (
              <div
                key={pass.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  isActive
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isUsed
                      ? "border-muted-foreground/20 bg-muted/30"
                      : "border-border bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg",
                        isExitPass ? "bg-blue-500/10" : "bg-violet-500/10",
                      )}
                    >
                      {isExitPass ? (
                        <LogOut className="h-4 w-4 text-blue-500" />
                      ) : (
                        <LogIn className="h-4 w-4 text-violet-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {isExitPass ? "EXIT QR" : "RETURN QR"}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2">
                        <StatusChip
                          variant={
                            isActive
                              ? "success"
                              : isUsed
                                ? "muted"
                                : "error"
                          }
                        >
                          {isActive
                            ? "Active"
                            : isUsed
                              ? "Used"
                              : "Invalidated"}
                        </StatusChip>
                        {pass.expiresAt && (
                          <span className="text-[10px] text-muted-foreground">
                            Expires: {formatDate(pass.expiresAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isActive && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = '/student/qr'}
                      className="gap-1.5"
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      Show QR
                    </Button>
                  )}

                  {isUsed && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Scanned
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : isApproved ? (
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-6 text-center">
            <QrCode className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No QR pass generated yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              Generate an exit pass to leave the hostel
            </p>
          </div>

          {qrError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {qrError}
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generating}
            className="w-full gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <QrCode className="h-4 w-4" />
                Generate QR Pass
              </>
            )}
          </Button>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-muted-foreground">
          Leave must be approved to generate a QR pass
        </p>
      )}
    </SectionCard>
  );
}

function MovementTimeline({ leaveId }: { leaveId: string }) {
  const { movements, isLoading, isError } = useMovement({
    leaveRequestId: leaveId,
    page: 1,
    limit: 50,
  });

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError)
    return (
      <p className="py-4 text-center text-sm text-destructive">
        Failed to load movements
      </p>
    );
  if (movements.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <MapPin className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No movement history yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Movement events will appear here when you scan your QR pass
        </p>
      </div>
    );

  const eventConfig: Record<
    string,
    { icon: React.ElementType; label: string; color: string; bg: string }
  > = {
    EXIT_HOSTEL: {
      icon: LogOut,
      label: "Exited Hostel",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    EXIT_CAMPUS: {
      icon: LogOut,
      label: "Exited Campus",
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    ENTER_CAMPUS: {
      icon: LogIn,
      label: "Entered Campus",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    ENTER_HOSTEL: {
      icon: LogIn,
      label: "Entered Hostel",
      color: "text-emerald-600",
      bg: "bg-emerald-600/10",
    },
    LEAVE_APPROVED: {
      icon: CheckCircle2,
      label: "Leave Approved",
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  };

  return (
    <div className="relative">
      {movements.map(
        (mov: Record<string, unknown>, i: number) => {
          const event = (mov.eventType as string) ?? "";
          const config = eventConfig[event] ?? {
            icon: MapPin,
            label: event,
            color: "text-muted-foreground",
            bg: "bg-muted",
          };
          const Icon = config.icon;
          const isLast = i === movements.length - 1;

          return (
            <div
              key={(mov.id as string) ?? i}
              className="relative flex gap-3"
            >
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                    config.bg,
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", config.color)} />
                </div>
                {!isLast && <div className="h-full w-px bg-border" />}
              </div>
              <div className={cn("min-w-0 flex-1 pb-6", isLast && "pb-0")}>
                <p className="text-sm font-medium">{config.label}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(mov.createdAt as string)}
                </p>
                {(mov.location as string) && (
                  <p className="text-xs text-muted-foreground">
                    {mov.location as string}
                  </p>
                )}
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}

function NotificationList({ leaveId }: { leaveId: string }) {
  const { notifications, isLoading } = useNotifications(1, 50);

  const leaveNotifications = notifications.items.filter(
    (n: NotificationItem) => {
      const meta = n.metadata as Record<string, unknown> | null;
      return (
        meta?.leaveRequestId === leaveId || n.leaveRequestId === leaveId
      );
    },
  );

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (leaveNotifications.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Bell className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No notifications for this leave
        </p>
      </div>
    );

  return (
    <div className="space-y-2">
      {leaveNotifications.map((n: NotificationItem) => (
        <div
          key={n.id}
          className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
        >
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
            <Bell className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium capitalize">
              {n.eventType.replace(/_/g, " ").toLowerCase()}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>via {n.channel}</span>
              <span>· {formatRelative(n.createdAt)}</span>
              {n.deliveryStatus === "FAILED" && (
                <span className="text-destructive">Failed</span>
              )}
            </div>
          </div>
          {!n.readAt && <span className="h-2 w-2 rounded-full bg-primary" />}
        </div>
      ))}
    </div>
  );
}

function AuditLog({ leaveId }: { leaveId: string }) {
  const { data, isLoading } = useSWR<{
    data: Array<{
      id: string;
      action: string;
      entityType: string;
      actorUserId: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: string;
    }>;
  }>(`/api/v1/audit?entityType=LEAVE_REQUEST&entityId=${leaveId}`);

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (!data?.data || data.data.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Shield className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No audit records</p>
      </div>
    );

  return (
    <div className="space-y-2">
      {data.data.map((entry) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <History className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium capitalize">
              {entry.action.replace(/_/g, " ").toLowerCase()}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatRelative(entry.createdAt)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function ExtensionsSection({ leaveId }: { leaveId: string }) {
  const { data, isLoading, isError } = useLeaveExtensions(leaveId);
  const [showAll, setShowAll] = useState(false);

  if (isLoading)
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError)
    return (
      <p className="py-4 text-center text-sm text-destructive">
        Failed to load extensions
      </p>
    );
  if (!data?.items || data.items.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <RotateCcw className="mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">
          No extensions requested
        </p>
      </div>
    );

  const displayed = showAll ? data.items : data.items.slice(0, 3);

  return (
    <div className="space-y-3">
      {displayed.map((ext) => {
        const extStatus = (ext.status ?? "").toLowerCase();
        return (
          <div
            key={ext.id}
            className="flex gap-3 rounded-xl border border-border p-3"
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  extStatus === "approved"
                    ? "bg-emerald-500/10 text-emerald-500"
                    : extStatus === "rejected"
                      ? "bg-red-500/10 text-red-500"
                      : "bg-amber-500/10 text-amber-500",
                )}
              >
                {extStatus === "approved" ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : extStatus === "rejected" ? (
                  <XCircle className="h-3.5 w-3.5" />
                ) : (
                  <Clock className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Extension #{ext.extensionNumber}
                </span>
                <StatusChip
                  variant={
                    extStatus === "approved"
                      ? "success"
                      : extStatus === "rejected"
                        ? "error"
                        : "warning"
                  }
                >
                  {extStatus === "approved"
                    ? "Approved"
                    : extStatus === "rejected"
                      ? "Rejected"
                      : "Pending"}
                </StatusChip>
              </div>
              {ext.createdAt && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelative(ext.createdAt)}
                </p>
              )}
              {ext.reason && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {ext.reason}
                </p>
              )}
            </div>
          </div>
        );
      })}
      {data.items.length > 3 && !showAll && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(true)}
          className="w-full gap-1 text-xs"
        >
          <ChevronDown className="h-3 w-3" />
          View all {data.items.length} extensions
        </Button>
      )}
      {showAll && data.items.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(false)}
          className="w-full gap-1 text-xs"
        >
          <ChevronUp className="h-3 w-3" />
          Show less
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function StudentLeaveDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { leave, isLoading, isError, error, mutate } = useLeave(id);

  // Action states
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [extending, setExtending] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelLeave(id);
      toast.success("Leave cancelled");
      await mutate();
      setShowCancel(false);
    } catch {
      toast.error("Failed to cancel leave");
    } finally {
      setCancelling(false);
    }
  };

  const handleExtensionSuccess = () => {
    setExtending(false);
    mutate();
  };

  // Loading / Error states
  if (isLoading) return <LoadingState count={4} />;
  if (isError)
    return (
      <ErrorState
        message={error?.message ?? "Leave not found"}
        onRetry={() => mutate()}
      />
    );
  if (!leave) return <ErrorState message="Leave not found" />;

  const status = (leave.status as string)?.toLowerCase();
  const isApproved = status === "approved";
  const isActive =
    status === "active" || (status === "approved" && !!leave.isActive);
  const isCompleted = status === "completed" || status === "expired" || status === "cancelled";
  const isCancellable = status === "pending" || isApproved;

  const studentName =
    leave.userFullName ??
    (`${leave.studentFirstName ?? ""} ${leave.studentLastName ?? ""}`.trim() || "");
  const rollNumber = leave.studentRollNumber ?? "—";
  const email = leave.userEmail ?? "";
  const phone = leave.userPhone ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex items-center gap-3">
            <span className="font-mono text-base">
              {leave.requestNumber ?? leave.id.slice(0, 8)}
            </span>
            <StatusBadge
              status={
                status as
                  | "approved"
                  | "pending"
                  | "rejected"
                  | "active"
              }
            />
          </div>
        }
        description={
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(leave.startAt)} — {formatDate(leave.endAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {getDuration(leave.startAt, leave.endAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              {leave.studentFirstName ?? "Student"}
            </span>
          </div>
        }
        action={
          <Button
            variant="outline"
            onClick={() => router.push("/student/leaves")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        }
      />

      {/* Status-Based Actions Bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
        {isCancellable && (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowCancel(true)}
            className="gap-1.5"
          >
            <XCircle className="h-4 w-4" />
            Cancel Leave
          </Button>
        )}
        {(isApproved || isActive) && (
          <>
            <Button
              variant="default"
              size="sm"
              onClick={() => setExtending(!extending)}
              className="gap-1.5"
            >
              <RotateCcw className="h-4 w-4" />
              {extending ? "Close" : "Request Extension"}
            </Button>
          </>
        )}
        {(isActive || isApproved) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push(`/student/qr`)}
            className="gap-1.5"
          >
            <QrCode className="h-4 w-4" />
            View QR
          </Button>
        )}
        {isCompleted && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/student/leaves")}
            className="gap-1.5"
          >
            <History className="h-4 w-4" />
            View History
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => mutate()}
          className="gap-1.5"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Extension Form */}
      {extending && (
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-4 flex items-center gap-2 text-base font-semibold">
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
            Request Extension
          </h3>
          <ExtensionForm
            leaveId={id}
            currentEndAt={leave.endAt}
            onSuccess={handleExtensionSuccess}
            onCancel={() => setExtending(false)}
          />
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column — Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Section 1 — Leave Summary */}
          <SectionCard title="Leave Summary" icon={FileText}>
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Leave Type
                </dt>
                <dd className="mt-1 font-medium">
                  {leave.leaveTypeName ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-1">
                  <StatusBadge
                    status={
                      status as
                        | "approved"
                        | "pending"
                        | "rejected"
                        | "active"
                    }
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Start Date
                </dt>
                <dd className="mt-1 font-medium">
                  {formatDate(leave.startAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  End Date
                </dt>
                <dd className="mt-1 font-medium">
                  {formatDate(leave.endAt)}
                </dd>
              </div>
              {leave.expectedReturnAt && (
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Expected Return
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(leave.expectedReturnAt)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Duration
                </dt>
                <dd className="mt-1 font-medium">
                  {getDuration(leave.startAt, leave.endAt)}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Reason
                </dt>
                <dd className="mt-1 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                  {leave.reason || "—"}
                </dd>
              </div>
            </dl>
          </SectionCard>

          {/* Section 2 — Approval Timeline */}
          <SectionCard title="Approval Timeline" icon={CheckCircle2}>
            <ApprovalTimeline leaveId={id} leaveStatus={status} />
          </SectionCard>
        </div>

        {/* Right Column — Sidebar */}
        <div className="space-y-6">
          {/* Student Info */}
          <SectionCard title="Student" icon={User}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  avatarColors[
                    Math.abs(studentName.charCodeAt(0)) % avatarColors.length
                  ],
                )}
              >
                {getInitials(studentName)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{studentName}</p>
                <p className="text-xs text-muted-foreground">{rollNumber}</p>
              </div>
            </div>
            {(email || phone) && (
              <div className="mt-4 space-y-2 border-t border-border pt-4">
                {email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`mailto:${email}`}
                      className="truncate text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {email}
                    </a>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <a
                      href={`tel:${phone}`}
                      className="text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {phone}
                    </a>
                  </div>
                )}
              </div>
            )}
          </SectionCard>

          {/* Section 3 — Parent Approval Status (only shown when a parent step exists) */}
          <ParentApprovalSection leaveId={id} />

          {/* Section 4 — Extensions */}
          <SectionCard title="Extensions" icon={RotateCcw}>
            <ExtensionsSection leaveId={id} />
          </SectionCard>
        </div>
      </div>

      {/* Section 5 — QR Passes (only shown for approved leaves) */}
      {isApproved && <QRPassSection leaveId={id} isApproved={true} />}

      {/* Section 6 — Movement Timeline */}
      <SectionCard title="Movement History" icon={MapPin}>
        <MovementTimeline leaveId={id} />
      </SectionCard>

      {/* Section 7 — Notifications */}
      <SectionCard title="Notifications" icon={Bell}>
        <NotificationList leaveId={id} />
      </SectionCard>

      {/* Section 8 — Audit Trail */}
      <SectionCard title="Audit Trail" icon={Shield}>
        <AuditLog leaveId={id} />
      </SectionCard>

      {/* Section 9 — Documents */}
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:shadow-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <FileText className="h-4 w-4 text-muted-foreground" />
              Documents
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Upload supporting documents (medical certificates, travel tickets,
              etc.)
            </p>
          </div>
          {uploadOpen ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUploadOpen(false)}
            >
              Cancel
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setUploadOpen(true)}
              className="gap-1.5"
            >
              <Upload className="h-4 w-4" />
              Upload
            </Button>
          )}
        </div>

        {uploadOpen && (
          <div className="mb-6">
            <DocumentUpload
              leaveId={id}
              onUploadSuccess={() => {
                setUploadOpen(false);
                mutate();
              }}
            />
          </div>
        )}

        <DocumentList leaveId={id} canDelete={true} />
      </div>

      {/* Cancel Confirmation */}
      <ConfirmationDialog
        open={showCancel}
        onOpenChange={setShowCancel}
        title="Cancel Leave"
        description="Are you sure you want to cancel this leave request? This action cannot be undone."
        confirmLabel="Yes, Cancel Leave"
        variant="destructive"
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </div>
  );
}
