"use client";

import { Loader2, Maximize2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { ROUTES } from "@/constants/routes";
import type { StudentDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { DashboardCard } from "@/features/dashboard/components/DashboardCard";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQrToken } from "@/hooks/use-qr-token";
import { generateQr } from "@/lib/api/movement-api";
import { formatDate, formatDateRange, formatDateTime, formatRelative, formatTimeRemaining } from "@/lib/date-utils";

function LocationBadge({ location }: { location: string }) {
  if (location === MOVEMENT_STATE.IN_HOSTEL) {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-emerald-500" />
        <span className="font-medium">Inside Hostel</span>
      </div>
    );
  }

  if (location === MOVEMENT_STATE.OUTSIDE_HOSTEL) {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-amber-500" />
        <span className="font-medium">Outside Hostel</span>
      </div>
    );
  }

  if (location === MOVEMENT_STATE.OVERDUE) {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-red-500" />
        <span className="font-medium">Overdue — Please return</span>
      </div>
    );
  }

  if (location === MOVEMENT_STATE.CHECKED_OUT) {
    return (
      <div className="flex items-center gap-2">
        <span className="size-2.5 rounded-full bg-amber-500" />
        <span className="font-medium">Checked Out</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="size-2.5 rounded-full bg-emerald-500" />
      <span className="font-medium">Inside Hostel</span>
    </div>
  );
}

function ApprovalStepIcon({ decision }: { decision: string }) {
  if (decision === "APPROVED" || decision === "AUTO_APPROVED") {
    return <span className="text-emerald-500 font-bold">✔</span>;
  }
  if (decision === "REJECTED" || decision === "CANCELLED") {
    return <span className="text-red-500 font-bold">✘</span>;
  }
  return <span className="text-muted-foreground">○</span>;
}

function ActivityDot({ type }: { type: string }) {
  const positive = ["LEAVE_APPROVED", "ENTER_HOSTEL", "QR_GENERATED", "LEAVE_COMPLETED"];
  const negative = ["LEAVE_REJECTED", "AUTO_OVERDUE", "QR_INVALIDATED"];
  if (positive.includes(type)) return <span className="text-emerald-500">✔</span>;
  if (negative.includes(type)) return <span className="text-red-500">✘</span>;
  return <span className="text-muted-foreground">●</span>;
}

export default function StudentDashboardPage() {
  const { userId } = useCurrentUser();
  const { stats, isLoading: statsLoading, isError: statsError, mutate: retryStats } = useDashboardStats();
  const { leaves, isLoading: leavesLoading } = useLeaves({ page: 1, limit: 5 });
  const { getTokenByLeaveId, storeToken } = useQrToken();
  const [qrTokenReady, setQrTokenReady] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [fullscreenQr, setFullscreenQr] = useState(false);

  const s = stats as StudentDashboardStats | null;
  const activeLeave = s?.activeLeave ?? null;
  const upcomingLeave = s?.upcomingLeave ?? null;
  const pendingCount = s?.pendingLeaves ?? 0;
  const approvedCount = s?.approvedLeaves ?? 0;
  const currentLocation = s?.currentLocation ?? MOVEMENT_STATE.IN_HOSTEL;
  const activeQr = s?.activeQr ?? null;
  const approvalProgress = s?.approvalProgress ?? null;
  const recentActivity = s?.recentActivity ?? [];

  const qrToken = activeLeave?.id ? getTokenByLeaveId(activeLeave.id) : null;
  const needsToken = !!(activeQr && activeLeave?.id && !qrToken);

  useEffect(() => {
    if (!needsToken || !activeLeave?.id || !userId || qrTokenReady || qrError) return;
    let cancelled = false;

    (async () => {
      try {
        // Contract §7: never destroy a working pass. generateQr is idempotent
        // for an ACTIVE pass — it returns the SAME stored token so the emailed
        // QR and the app QR stay consistent. Only a broken (invalidated,
        // never-used) pass is re-issued, and that happens inside the service.
        const result = (await generateQr(activeLeave.id, "LEAVE_EXIT")) as {
          passId: string;
          token: string;
        } | null;
        if (!cancelled && result?.passId && result?.token) {
          storeToken(result.passId, result.token, activeLeave.id);
          setQrTokenReady(true);
        }
        if (!cancelled) await retryStats();
      } catch (err) {
        if (!cancelled) {
          setQrError(err instanceof Error ? err.message : "Failed to load QR");
        }
      }
    })();

    return () => { cancelled = true; };
  }, [needsToken, activeLeave?.id, userId, qrTokenReady, qrError]);

  const hasQr = !!(activeQr && (qrToken || qrTokenReady));
  const loadingQr = needsToken && !qrError;

  const nextPendingStep = approvalProgress?.find((s) => s.decision === "PENDING");

  const dynamicActions: Array<{ label: string; href?: string; onClick?: () => void; variant: "default" | "outline" | "ghost" }> = [];
  if (hasQr) {
    dynamicActions.push({ label: "Fullscreen QR", onClick: () => setFullscreenQr(true), variant: "default" });
  }
  if (nextPendingStep) {
    dynamicActions.push({ label: "View Approval Progress", href: `/student/leaves`, variant: "outline" });
  }
  if (!activeLeave && pendingCount === 0) {
    dynamicActions.push({ label: "Raise New Leave", href: ROUTES.STUDENT_LEAVE_NEW, variant: "default" });
  }
  dynamicActions.push({ label: "Leave History", href: "/student/leaves", variant: "ghost" });

  if (statsLoading || leavesLoading) {
    return <LoadingState count={4} />;
  }

  if (statsError) {
    return <ErrorState message="Failed to load dashboard" onRetry={() => { retryStats(); }} />;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Your hostel leave, movement, and QR status at a glance."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardCard title="Current Status">
          <LocationBadge location={currentLocation} />
          {activeLeave && (
            <p className="mt-2 text-xs text-muted-foreground">
              On leave: {activeLeave.leaveType}
            </p>
          )}
          {nextPendingStep && (
            <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
              Waiting for {nextPendingStep.label}
            </p>
          )}
        </DashboardCard>

        <DashboardCard title="Active Leave">
          {activeLeave ? (
            <div className="space-y-1">
              <p className="font-medium">{activeLeave.leaveType}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateRange(activeLeave.startAt, activeLeave.endAt)}
              </p>
              <span className="inline-block mt-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
                {activeLeave.status.toLowerCase()}
              </span>
              {upcomingLeave && (
                <p className="text-xs text-muted-foreground">
                  Next: {upcomingLeave.leaveType} from {formatDate(upcomingLeave.startAt)}
                </p>
              )}
            </div>
          ) : upcomingLeave ? (
            <div className="space-y-1">
              <p className="font-medium">{upcomingLeave.leaveType}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateRange(upcomingLeave.startAt, upcomingLeave.endAt)}
              </p>
              <span className="inline-block mt-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                Upcoming
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active leave</p>
          )}
        </DashboardCard>

        <DashboardCard title={nextPendingStep ? `Waiting for ${nextPendingStep.label}` : "Pending Requests"}>
          {pendingCount > 0 ? (
            <div className="space-y-1">
              <p className="text-2xl font-bold">{pendingCount}</p>
              {nextPendingStep && (
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                  {nextPendingStep.label}
                </p>
              )}
              <Link href="/student/leaves" className="text-xs text-primary hover:underline">
                View details →
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="text-2xl font-bold text-muted-foreground">0</p>
              {approvedCount > 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  {approvedCount} approved recently
                </p>
              )}
            </div>
          )}
        </DashboardCard>

        <DashboardCard title="QR Pass">
          {activeQr ? (
            <div className="space-y-1">
              <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Ready</p>
              {activeQr.expiresAt && (
                <p className="text-xs text-muted-foreground">{formatTimeRemaining(activeQr.expiresAt)}</p>
              )}
            </div>
          ) : upcomingLeave ? (
            <p className="text-sm text-muted-foreground">
              QR available from {formatDate(upcomingLeave.startAt)}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No QR pass</p>
          )}
        </DashboardCard>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <DashboardCard title={activeLeave ? activeLeave.leaveType : "Current Leave"} description={activeLeave ? `${activeLeave.status.toLowerCase()} — ${formatDateRange(activeLeave.startAt, activeLeave.endAt)}` : "No active leave request"}>
            {activeLeave ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Started {formatDateTime(activeLeave.startAt)}</span>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize">
                    {activeLeave.status.toLowerCase()}
                  </span>
                </div>

                {activeQr && (
                  <div className="flex items-center gap-4 rounded-xl bg-muted p-4">
                    <div className="relative shrink-0">
                      {loadingQr ? (
                        <div className="flex size-[140px] items-center justify-center">
                          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                      ) : qrError ? (
                        <p className="text-sm text-destructive">{qrError}</p>
                      ) : hasQr ? (
                        <button type="button" onClick={() => setFullscreenQr(true)} className="cursor-pointer">
                          <QrCodeDisplay token={qrToken ?? ""} size={140} />
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition-colors hover:bg-black/5">
                            <Maximize2 className="size-5 text-white/0 transition-colors group-hover:text-white/70" />
                          </div>
                        </button>
                      ) : null}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-sm font-medium">QR Pass</p>
                      {activeQr.expiresAt && (
                        <p className="text-xs text-muted-foreground">{formatTimeRemaining(activeQr.expiresAt)}</p>
                      )}
                      <p className="text-xs text-muted-foreground">Tap QR for fullscreen</p>
                    </div>
                  </div>
                )}

                {approvalProgress && approvalProgress.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Approval Progress</p>
                    <div className="flex items-center gap-1.5">
                      {approvalProgress.map((step, idx) => (
                        <div key={step.stepKey} className="flex items-center gap-1.5">
                          <div className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                            step.decision === "APPROVED" || step.decision === "AUTO_APPROVED"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : step.decision === "REJECTED"
                                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                                : "bg-muted text-muted-foreground"
                          }`}>
                            <ApprovalStepIcon decision={step.decision} />
                            {step.label}
                          </div>
                          {idx < approvalProgress.length - 1 && (
                            <span className="text-muted-foreground/40">→</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">No active leave request</p>
                <Link href={ROUTES.STUDENT_LEAVE_NEW}>
                  <Button size="sm">Raise a Leave</Button>
                </Link>
              </div>
            )}
          </DashboardCard>

          <DashboardCard title="Recent Leaves" description="Your most recent leave requests.">
            {leaves.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave requests yet.</p>
            ) : (
              <div className="space-y-3">
                {leaves.map((leave: { id: string; leaveTypeName?: string; startAt: string; endAt: string; status: string }) => (
                  <Link
                    key={leave.id}
                    href={`/student/leaves/${leave.id}`}
                    className="flex items-center justify-between rounded-xl bg-muted p-4 transition-colors hover:bg-muted/70"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{leave.leaveTypeName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateRange(leave.startAt, leave.endAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize shrink-0 ml-4">
                      {leave.status.toLowerCase()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>

        <div className="space-y-6">
          <DashboardCard title="Quick Actions">
            <div className="flex flex-col gap-3">
              {dynamicActions.length === 0 && (
                <p className="text-sm text-muted-foreground">No actions available</p>
              )}
              {dynamicActions.map((action, idx) => (
                action.href ? (
                  <Link key={idx} href={action.href}>
                    <Button variant={action.variant} className="w-full">{action.label}</Button>
                  </Link>
                ) : (
                  <Button key={idx} variant={action.variant} className="w-full" onClick={action.onClick}>
                    {action.label}
                  </Button>
                )
              ))}
            </div>
          </DashboardCard>

          <DashboardCard title="Recent Activity">
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((act, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <ActivityDot type={act.type} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{act.description}</p>
                      <p className="text-xs text-muted-foreground">{formatRelative(act.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCard>
        </div>
      </section>

      {fullscreenQr && hasQr && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setFullscreenQr(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/70 hover:bg-white/20 hover:text-white"
            onClick={() => setFullscreenQr(false)}
          >
            <X className="size-6" />
          </button>
          <div className="rounded-2xl bg-white p-8" onClick={(e) => e.stopPropagation()}>
            <QrCodeDisplay token={qrToken ?? ""} size={320} />
          </div>
        </div>
      )}
    </div>
  );
}
