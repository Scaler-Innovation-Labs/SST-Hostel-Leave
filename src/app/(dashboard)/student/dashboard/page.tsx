"use client";

import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { MOVEMENT_STATE } from "@/constants/movement/movement-state";
import { ROUTES } from "@/constants/routes";
import type { StudentDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { useLeaves } from "@/features/leaves/hooks/use-leaves";

export default function StudentDashboardPage() {
  const { stats, isLoading: statsLoading, isError: statsError, mutate: retryStats } = useDashboardStats();
  const { leaves, isLoading: leavesLoading } = useLeaves({ page: 1, limit: 5 });

  if (statsLoading || leavesLoading) {
    return <LoadingState count={4} />;
  }

  if (statsError) {
    return <ErrorState message="Failed to load dashboard" onRetry={() => { retryStats(); }} />;
  }

  const s = stats as StudentDashboardStats | null;
  const activeLeave = s?.activeLeave ?? null;
  const pendingCount = s?.pendingLeaves ?? 0;
  const currentLocation = s?.currentLocation ?? MOVEMENT_STATE.IN_HOSTEL;
  const activeQr = s?.activeQr ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Student Dashboard"
        description="Manage your hostel leaves, QR passes, and movement activity."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Active Leave"
          value={activeLeave ? activeLeave.leaveType : "None"}
          className={activeLeave ? "border-primary/30" : ""}
        />
        <InfoCard
          label="Pending Requests"
          value={pendingCount}
        />
        <InfoCard
          label="Movement Status"
          value={currentLocation === MOVEMENT_STATE.IN_HOSTEL ? "IN" : "OUT"}
        />
        <InfoCard
          label="QR Status"
          value={activeQr ? "VALID" : "NONE"}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Current Leave</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your active leave request.</p>
            </div>
            {activeLeave ? (
              <div className="flex items-center justify-between rounded-xl bg-muted p-4">
                <div>
                  <p className="font-medium">{activeLeave.leaveType}</p>
                  <p className="text-sm text-muted-foreground">
                    {activeLeave.startAt} → {activeLeave.endAt}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary capitalize">
                  {activeLeave.status.toLowerCase()}
                </span>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active leave.</p>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Recent Leaves</h3>
              <p className="mt-1 text-sm text-muted-foreground">Your most recent leave requests.</p>
            </div>
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
                    <div>
                      <p className="text-sm font-medium">{leave.leaveTypeName}</p>
                      <p className="text-xs text-muted-foreground">
                        {leave.startAt} → {leave.endAt}
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
                      {leave.status.toLowerCase()}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="mb-4">
              <h3 className="text-base font-semibold">Quick Actions</h3>
              <p className="mt-1 text-sm text-muted-foreground">Common student actions.</p>
            </div>
            <div className="flex flex-col gap-3">
              <Link href={ROUTES.STUDENT_LEAVE_NEW}>
                <Button className="w-full">Raise New Leave</Button>
              </Link>
              <Link href="/student/leaves">
                <Button variant="outline" className="w-full">View My Leaves</Button>
              </Link>
              <Link href="/student/qr">
                <Button variant="ghost" className="w-full">View QR Pass</Button>
              </Link>
            </div>
          </div>

        </div>
      </section>
    </div>
  );
}
