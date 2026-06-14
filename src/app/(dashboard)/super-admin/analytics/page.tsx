"use client";

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  QrCode,
  Route,
  ThumbsDown,
  Users,
} from "lucide-react";

import { AnalyticsAreaChart } from "@/components/analytics/AreaChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import type { StaffDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";

export default function SuperAdminAnalyticsPage() {
  const { stats, isLoading, isError, mutate } = useDashboardStats();

  if (isLoading) return <LoadingState count={8} />;
  if (isError) return <ErrorState message="Failed to load analytics" onRetry={() => mutate()} />;

  const s = stats as StaffDashboardStats;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="System-wide statistics and metrics for leave and movement management."
      />

      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Total Leaves"
          value={s.totalLeaves as number ?? 0}
          icon={<Activity className="h-4 w-4" />}
        />
        <InfoCard
          label="Approved"
          value={s.approvedLeaves as number ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <InfoCard
          label="Rejected"
          value={s.rejectedLeaves as number ?? 0}
          icon={<ThumbsDown className="h-4 w-4" />}
        />
        <InfoCard
          label="Pending Approvals"
          value={s.pendingApprovals as number ?? 0}
          icon={<Clock className="h-4 w-4" />}
        />
        <InfoCard
          label="Active Students"
          value={s.activeStudents as number ?? 0}
          icon={<Users className="h-4 w-4" />}
        />
        <InfoCard
          label="Overdue Returns"
          value={s.overdueStudents as number ?? 0}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <InfoCard
          label="Active QR Passes"
          value={s.activeQrPasses as number ?? 0}
          icon={<QrCode className="h-4 w-4" />}
        />
        <InfoCard
          label="Movement Events (7d)"
          value={s.movementEvents as number ?? 0}
          icon={<Route className="h-4 w-4" />}
        />
      </section>

      {/* Secondary metrics */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Users</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {s.totalUsers as number ?? 0}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Outside Hostel</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {s.studentsOutside as number ?? 0}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Approvals (7d)</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {s.recentApprovalsCount as number ?? 0}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs text-muted-foreground">Avg Approval Time</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {s.averageApprovalHours != null
              ? `${s.averageApprovalHours}h`
              : "—"}
          </p>
        </div>
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsAreaChart
          title="Leaves Created (Last 7 Days)"
          description="Daily leave submissions over the past week."
          data={(s.leavesLast7Days as Array<{ date: string; value: number }>) ?? []}
          color="#6366f1"
        />

        <AnalyticsAreaChart
          title="Approvals (Last 7 Days)"
          description="Daily approval decisions over the past week."
          data={(s.approvalsLast7Days as Array<{ date: string; value: number }>) ?? []}
          color="#10b981"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsAreaChart
          title="Leaves Created (Last 30 Days)"
          description="Daily leave submissions over the past month."
          data={(s.leavesLast30Days as Array<{ date: string; value: number }>) ?? []}
          color="#f59e0b"
          height={200}
        />

        <LeaveTypePieChart
          title="Leave Type Breakdown"
          data={(s.leaveTypeBreakdown as Array<{ name: string; count: number }>) ?? []}
        />
      </div>
    </div>
  );
}
