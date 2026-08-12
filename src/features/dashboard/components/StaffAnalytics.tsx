"use client";

import {
  Activity,
  CheckCircle2,
  Clock,
  ThumbsDown,
  X,
} from "lucide-react";
import { useState } from "react";

import { AnalyticsAreaChart } from "@/components/analytics/AreaChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import type { StaffDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";

type NumericStatKey = {
  [K in keyof StaffDashboardStats]: StaffDashboardStats[K] extends number | string ? K : never;
}[keyof StaffDashboardStats];

type StaffAnalyticsProps = {
  description: string;
  /** Extra KPI cards appended after the standard ones (e.g. role-specific metrics). */
  extraCards?: Array<{
    label: string;
    /** Key of StaffDashboardStats to read the value from, or a literal value. */
    valueKey?: NumericStatKey;
    value?: number | string;
    icon: React.ReactNode;
    tone?: "primary" | "success" | "warning" | "danger";
  }>;
  /** Hides the component's own page header, for embedding inside a parent page. */
  hidePageHeader?: boolean;
};

type StatusFilter = "" | "APPROVED" | "REJECTED" | "PENDING";

const STATUS_FILTERS: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "", label: "All Leaves" },
  { value: LEAVE_REQUEST_STATUS.APPROVED, label: "Approved" },
  { value: LEAVE_REQUEST_STATUS.REJECTED, label: "Rejected" },
  { value: LEAVE_REQUEST_STATUS.PENDING, label: "Pending Approvals" },
];

export function StaffAnalytics({ description, extraCards = [], hidePageHeader = false }: StaffAnalyticsProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const { stats, isLoading, isError, mutate } = useDashboardStats(statusFilter);

  if (isLoading && !stats) return <LoadingState count={6} />;
  if (isError && !stats) return <ErrorState message="Failed to load analytics" onRetry={() => mutate()} />;

  const s = stats as StaffDashboardStats;

  const toggleFilter = (value: StatusFilter) => {
    setStatusFilter((current) => (current === value ? "" : value));
  };

  const activeLabel = STATUS_FILTERS.find((f) => f.value === statusFilter)?.label;

  return (
    <div className="space-y-8">
      {!hidePageHeader && <PageHeader title="Analytics" description={description} />}

      {/* Status filter KPIs — compact and clickable */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Total Leaves"
          value={s.totalLeaves as number ?? 0}
          icon={<Activity className="h-4 w-4" />}
          tone="primary"
          compact
          onClick={() => toggleFilter("")}
          active={statusFilter === ""}
        />
        <InfoCard
          label="Approved"
          value={s.approvedLeaves as number ?? 0}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
          compact
          onClick={() => toggleFilter(LEAVE_REQUEST_STATUS.APPROVED)}
          active={statusFilter === LEAVE_REQUEST_STATUS.APPROVED}
        />
        <InfoCard
          label="Rejected"
          value={s.rejectedLeaves as number ?? 0}
          icon={<ThumbsDown className="h-4 w-4" />}
          tone="danger"
          compact
          onClick={() => toggleFilter(LEAVE_REQUEST_STATUS.REJECTED)}
          active={statusFilter === LEAVE_REQUEST_STATUS.REJECTED}
        />
        <InfoCard
          label="Pending Approvals"
          value={s.pendingApprovals as number ?? 0}
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
          compact
          onClick={() => toggleFilter(LEAVE_REQUEST_STATUS.PENDING)}
          active={statusFilter === LEAVE_REQUEST_STATUS.PENDING}
        />
      </section>

      {/* Active filter indicator */}
      {statusFilter && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Filtering leaves by{" "}
            <span className="font-semibold text-foreground">{activeLabel}</span>
          </span>
          <button
            onClick={() => setStatusFilter("")}
            className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
          >
            <X className="h-3 w-3" />
            Clear filter
          </button>
        </div>
      )}

      {/* Secondary metrics */}
      <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <InfoCard
          label="Outside Hostel"
          value={s.studentsOutside as number ?? 0}
          tone="warning"
        />
        <InfoCard
          label="Approvals (7d)"
          value={s.recentApprovalsCount as number ?? 0}
          tone="success"
        />
        <InfoCard
          label="Avg Approval Time"
          value={s.averageApprovalHours != null ? `${s.averageApprovalHours}h` : "—"}
          tone="primary"
        />
        {extraCards.map((card) => (
          <InfoCard
            key={card.label}
            label={card.label}
            value={card.valueKey ? s[card.valueKey] : (card.value ?? "—")}
            icon={card.icon}
            tone={card.tone}
          />
        ))}
      </section>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsAreaChart
          title={`Leaves Created (Last 7 Days)${statusFilter ? ` — ${activeLabel}` : ""}`}
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
          title={`Leaves Created (Last 30 Days)${statusFilter ? ` — ${activeLabel}` : ""}`}
          description="Daily leave submissions over the past month."
          data={(s.leavesLast30Days as Array<{ date: string; value: number }>) ?? []}
          color="#f59e0b"
          height={200}
        />

        <LeaveTypePieChart
          title={`Leave Type Breakdown${statusFilter ? ` — ${activeLabel}` : ""}`}
          data={s.leaveTypeBreakdown ?? []}
        />
      </div>
    </div>
  );
}
