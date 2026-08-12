"use client";

import { CheckCircle2, Clock, FileText, ThumbsDown, XCircle } from "lucide-react";

import { AnalyticsAreaChart } from "@/components/analytics/AreaChart";
import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { MultiSeriesBarChart, type SeriesDef } from "@/components/analytics/MultiSeriesBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { LeaveAnalytics, StatusTrendPoint } from "@/dto/analytics/leave-analytics.dto";
import { useLeaveAnalytics } from "@/features/analytics/hooks/use-analytics";

const STATUS_SERIES: SeriesDef[] = [
  { key: "PENDING", label: "Pending", color: "#f59e0b" },
  { key: "APPROVED", label: "Approved", color: "#10b981" },
  { key: "REJECTED", label: "Rejected", color: "#ef4444" },
  { key: "CANCELLED", label: "Cancelled", color: "#94a3b8" },
];

function pivotStatusTrend(rows: StatusTrendPoint[]): Array<Record<string, string | number>> {
  const byDate = new Map<string, Record<string, string | number>>();
  for (const row of rows) {
    const existing = byDate.get(row.date) ?? { date: row.date };
    existing[row.status] = (typeof existing[row.status] === "number" ? existing[row.status] : 0) as number + row.count;
    byDate.set(row.date, existing);
  }
  return [...byDate.values()];
}

type LeavesTabProps = {
  period: AnalyticsPeriod;
};

export function LeavesTab({ period }: LeavesTabProps) {
  const { data, isLoading, isError, mutate } = useLeaveAnalytics(period);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) return <ErrorState message="Failed to load leave analytics" onRetry={() => mutate()} />;

  const d = data as LeaveAnalytics;

  const avgHours =
    d.averageApprovalHours != null
      ? d.averageApprovalHours >= 1
        ? `${Math.round(d.averageApprovalHours * 10) / 10}h`
        : `${Math.round(d.averageApprovalHours * 60)}m`
      : "—";

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Total Leaves" value={d.totalLeaves} icon={<FileText className="h-4 w-4" />} tone="primary" />
        <InfoCard label="Approved" value={d.approved} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <InfoCard label="Rejected" value={d.rejected} icon={<ThumbsDown className="h-4 w-4" />} tone="danger" />
        <InfoCard label="Pending" value={d.pending} icon={<Clock className="h-4 w-4" />} tone="warning" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <InfoCard label="Cancelled" value={d.cancelled} icon={<XCircle className="h-4 w-4" />} />
        <InfoCard label="Avg Approval Time" value={avgHours} icon={<Clock className="h-4 w-4" />} tone="success" />
      </section>

      <AnalyticsAreaChart
        title="Leaves Created Trend"
        description="Daily leave submissions over the selected period."
        data={d.leaveTrend.map((point) => ({ date: point.date, value: point.value }))}
        color="#6366f1"
      />

      <MultiSeriesBarChart
        title="Leaves by Status"
        description="Daily submissions split by current status."
        data={pivotStatusTrend(d.statusTrend)}
        series={STATUS_SERIES}
        stacked
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaveTypePieChart title="Leave Type Breakdown" data={d.byLeaveType} />
        <AnalyticsBarChart title="Leaves by Hostel" description="Leave submissions across hostels." data={d.byHostel} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart title="Leaves by Department" description="Leave submissions across departments." data={d.byDepartment} />
        <AnalyticsBarChart title="Leave Duration Distribution" description="Approved leaves grouped by length in days." data={d.durationDistribution} />
      </div>
    </div>
  );
}

export default LeavesTab;