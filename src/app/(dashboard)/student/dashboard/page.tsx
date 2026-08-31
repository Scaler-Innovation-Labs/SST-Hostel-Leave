"use client";

import {
  CalendarPlus,
  Check,
  Clock,
  FileText,
  History,
  Maximize2,
  QrCode,
  ScanLine,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import type { MovementState } from "@/constants/movement/movement-state";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { ROUTES } from "@/constants/routes";
import {
  Button,
  EditorialRow,
  EmptyState,
  ErrorState,
  Masthead,
  MetricSkeleton,
  MetricTile,
  MOVEMENT_STATE_PRESENTATION,
  Refusal,
  RowSkeleton,
  SectionCard,
  Skeleton,
  StatusBadge,
  TECH_LABEL,
} from "@/design-system/sst";
import type { StudentDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { ApprovalTrail } from "@/features/dashboard/components/ApprovalTrail";
import { QrPassDialog } from "@/features/dashboard/components/QrPassDialog";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useQrToken } from "@/hooks/use-qr-token";
import { generateQr } from "@/lib/api/movement-api";
import {
  formatDate,
  formatDateRange,
  formatRelative,
  formatTimeRemaining,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

/** Activity is a log, so its marker is a tone, not a second status vocabulary. */
const POSITIVE_ACTIVITY = [
  "LEAVE_APPROVED",
  "ENTER_HOSTEL",
  "QR_GENERATED",
  "LEAVE_COMPLETED",
];
const NEGATIVE_ACTIVITY = [
  "LEAVE_REJECTED",
  "AUTO_OVERDUE",
  "QR_INVALIDATED",
];

function activityTone(type: string): string {
  if (POSITIVE_ACTIVITY.includes(type)) return "bg-success";
  if (NEGATIVE_ACTIVITY.includes(type)) return "bg-danger";
  return "bg-border-strong";
}

function movementPresentation(location: string) {
  return (
    MOVEMENT_STATE_PRESENTATION[location as MovementState] ??
    MOVEMENT_STATE_PRESENTATION.IN_HOSTEL
  );
}

export default function StudentDashboardPage() {
  const { userId } = useCurrentUser();
  const {
    stats,
    isLoading: statsLoading,
    isError: statsError,
    mutate: retryStats,
  } = useDashboardStats();
  const { leaves, isLoading: leavesLoading } = useLeaves({ page: 1, limit: 5 });
  const { getTokenByLeaveId, storeToken } = useQrToken();
  const [qrTokenReady, setQrTokenReady] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [passOpen, setPassOpen] = useState(false);

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
    if (!needsToken || !activeLeave?.id || !userId || qrTokenReady || qrError)
      return;
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
          setQrError(
            err instanceof Error ? err.message : "The pass didn't load"
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    needsToken,
    activeLeave?.id,
    userId,
    qrTokenReady,
    qrError,
    retryStats,
    storeToken,
  ]);

  const hasQr = !!(activeQr && (qrToken || qrTokenReady));
  const loadingQr = needsToken && !qrError;
  const nextPendingStep = approvalProgress?.find(
    (step) => step.decision === "PENDING"
  );
  const isOverdue = currentLocation === MOVEMENT_STATE.OVERDUE;
  const location = movementPresentation(currentLocation);

  if (statsLoading || leavesLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 rounded-2xl" />
        <MetricSkeleton count={3} />
        <RowSkeleton rows={3} />
      </div>
    );
  }

  if (statsError) {
    return (
      <ErrorState
        title="We couldn't load your dashboard"
        description="The request didn't come back from the server. Your leaves and passes are unaffected."
        onRetry={() => {
          retryStats();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Masthead
        eyebrow="Student"
        title="Your leave"
        description="Where you are, what's approved, and the pass that gets you through the gate."
        status={{ label: location.label, tone: location.tone }}
        actions={
          <Button asChild variant="onDark" size="sm">
            <Link href={ROUTES.STUDENT_LEAVE_NEW}>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              Request leave
            </Link>
          </Button>
        }
      />

      {isOverdue && activeLeave && (
        <Refusal
          what="You're past your return time"
          why={`Your ${activeLeave.leaveType} was due back at ${formatDateRange(activeLeave.startAt, activeLeave.endAt)}.`}
          whatNow="Return to the hostel and scan in at the gate. If you need longer, request an extension from the leave itself."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={`${ROUTES.STUDENT_LEAVES}/${activeLeave.id}`}>
                Open this leave
              </Link>
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricTile
          label="Awaiting approval"
          value={pendingCount}
          Icon={Clock}
          tone={pendingCount > 0 ? "warning" : undefined}
        />
        <MetricTile
          label="Approved"
          value={approvedCount}
          Icon={Check}
          tone={approvedCount > 0 ? "success" : undefined}
        />
        <MetricTile
          label="Gate pass"
          value={activeQr ? "Ready" : "None"}
          unit={
            activeQr?.expiresAt
              ? formatTimeRemaining(activeQr.expiresAt)
              : undefined
          }
          Icon={QrCode}
          tone={activeQr ? "accent" : undefined}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <SectionCard
            Icon={FileText}
            title={activeLeave ? activeLeave.leaveType : "Current leave"}
            meta={
              activeLeave
                ? formatDateRange(activeLeave.startAt, activeLeave.endAt)
                : undefined
            }
            action={
              activeLeave ? (
                <StatusBadge
                  status={{
                    tone: "accent",
                    label: activeLeave.status.toLowerCase(),
                    Icon: ScanLine,
                  }}
                />
              ) : undefined
            }
          >
            {activeLeave ? (
              <div className="space-y-4">
                {activeQr && (
                  <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-sunken p-4">
                    <div className="shrink-0">
                      {loadingQr ? (
                        <Skeleton className="h-[140px] w-[140px] rounded-xl" />
                      ) : qrError ? (
                        <div className="flex h-[140px] w-[140px] items-center justify-center rounded-xl border border-danger/30 bg-danger-light p-3 text-center">
                          <p className="text-caption text-danger">{qrError}</p>
                        </div>
                      ) : hasQr ? (
                        <button
                          type="button"
                          onClick={() => setPassOpen(true)}
                          aria-label="Show the gate pass full screen"
                          className={cn(
                            "group relative rounded-xl bg-white p-2",
                            "transition-transform duration-fast ease-standard active:translate-y-px",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
                          )}
                        >
                          <QrCodeDisplay token={qrToken ?? ""} size={140} />
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-surface-ink/0 transition-colors duration-fast ease-standard group-hover:bg-surface-ink/40">
                            <Maximize2
                              className="h-5 w-5 text-white opacity-0 transition-opacity duration-fast ease-standard group-hover:opacity-100"
                              aria-hidden
                            />
                          </span>
                        </button>
                      ) : null}
                    </div>

                    <div className="min-w-0 space-y-1">
                      <p className={TECH_LABEL}>Gate pass</p>
                      {activeQr.expiresAt && (
                        <p className="text-body font-semibold text-ink">
                          {formatTimeRemaining(activeQr.expiresAt)}
                        </p>
                      )}
                      <p className="text-caption text-muted">
                        Tap the code to show it full screen at the gate.
                      </p>
                    </div>
                  </div>
                )}

                {approvalProgress && approvalProgress.length > 0 && (
                  <div className="space-y-2">
                    <p className={TECH_LABEL}>Approval chain</p>
                    <ApprovalTrail steps={approvalProgress} />
                    {nextPendingStep && (
                      <p className="text-caption text-muted">
                        Waiting on {nextPendingStep.label}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : upcomingLeave ? (
              <div className="space-y-3">
                <p className="text-body text-muted">
                  Your next leave is {upcomingLeave.leaveType}, starting{" "}
                  {formatDate(upcomingLeave.startAt)}. Your gate pass appears
                  here when it begins.
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href={`${ROUTES.STUDENT_LEAVES}/${upcomingLeave.id}`}>
                    Open this leave
                  </Link>
                </Button>
              </div>
            ) : (
              <EmptyState
                Icon={CalendarPlus}
                title="No leave in progress"
                description="Request one and it'll show up here with its approval chain and gate pass."
                action={
                  <Button asChild size="sm" trailingArrow>
                    <Link href={ROUTES.STUDENT_LEAVE_NEW}>Request leave</Link>
                  </Button>
                }
              />
            )}
          </SectionCard>

          <SectionCard
            Icon={History}
            title="Recent leaves"
            meta={leaves.length > 0 ? `${leaves.length} shown` : undefined}
            action={
              leaves.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={ROUTES.STUDENT_LEAVES}>See all</Link>
                </Button>
              ) : undefined
            }
          >
            {leaves.length === 0 ? (
              <EmptyState
                Icon={FileText}
                title="No leave requests yet"
                description="Your requests and their outcomes will be listed here."
                action={
                  <Button asChild size="sm" trailingArrow>
                    <Link href={ROUTES.STUDENT_LEAVE_NEW}>Request leave</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3">
                {leaves.map(
                  (leave: {
                    id: string;
                    leaveTypeName?: string;
                    startAt: string;
                    endAt: string;
                    status: string;
                  }) => (
                    <EditorialRow
                      key={leave.id}
                      Icon={FileText}
                      title={leave.leaveTypeName ?? "Leave request"}
                      meta={formatDateRange(leave.startAt, leave.endAt)}
                      href={`${ROUTES.STUDENT_LEAVES}/${leave.id}`}
                      tone="accent"
                    />
                  )
                )}
              </div>
            )}
          </SectionCard>
        </div>

        <SectionCard
          Icon={History}
          title="Recent activity"
          meta={
            recentActivity.length > 0
              ? `${recentActivity.length} events`
              : undefined
          }
        >
          {recentActivity.length === 0 ? (
            <EmptyState
              Icon={History}
              title="Nothing has happened yet"
              description="Approvals, gate scans and pass changes appear here as they happen."
            />
          ) : (
            <ul className="divide-y divide-border">
              {recentActivity.slice(0, 6).map((activity, index) => (
                <li
                  key={`${activity.type}-${index}`}
                  className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      activityTone(activity.type)
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-small text-ink">
                      {activity.description}
                    </p>
                    <p className="text-caption text-muted">
                      {formatRelative(activity.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      {hasQr && (
        <QrPassDialog
          open={passOpen}
          onOpenChange={setPassOpen}
          token={qrToken ?? ""}
          validFor={
            activeQr?.expiresAt
              ? `Valid for ${formatTimeRemaining(activeQr.expiresAt)}.`
              : undefined
          }
        />
      )}
    </div>
  );
}
