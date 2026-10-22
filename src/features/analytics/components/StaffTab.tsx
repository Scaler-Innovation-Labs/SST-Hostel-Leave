"use client";

import { CheckCircle2, Clock, ShieldCheck, ThumbsDown, Users } from "lucide-react";

import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { MultiSeriesBarChart, type SeriesDef } from "@/components/analytics/MultiSeriesBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CHART,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableScroll,
} from "@/design-system/sst";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { StaffAnalytics } from "@/dto/analytics/staff-analytics.dto";
import { useStaffAnalytics } from "@/features/analytics/hooks/use-analytics";

const STAFF_DECISION_SERIES: SeriesDef[] = [
  { key: "approved", label: "Approved", color: CHART.success },
  { key: "rejected", label: "Rejected", color: CHART.danger },
];

function formatHours(hours: number | null | undefined): string {
  if (hours == null) return "—";
  if (hours >= 1) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours * 60)}m`;
}

type StaffTabProps = {
  period: AnalyticsPeriod;
};

export function StaffTab({ period }: StaffTabProps) {
  const { data, isLoading, isError, mutate } = useStaffAnalytics(period);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) {
    return <ErrorState message="Failed to load staff analytics" onRetry={() => mutate()} />;
  }

  const d = data as StaffAnalytics;

  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <InfoCard
          label="Total Decisions"
          value={d.totalDecisions}
          icon={<ShieldCheck className="h-4 w-4" />}
          tone="accent"
        />
        <InfoCard
          label="Approved by Staff"
          value={d.totalApproved}
          icon={<CheckCircle2 className="h-4 w-4" />}
          tone="success"
        />
        <InfoCard
          label="Rejected by Staff"
          value={d.totalRejected}
          icon={<ThumbsDown className="h-4 w-4" />}
          tone="danger"
        />
        <InfoCard
          label="Pending on Staff"
          value={d.pendingOnStaff}
          icon={<Clock className="h-4 w-4" />}
          tone="warning"
        />
        <InfoCard
          label="Avg Turnaround Time"
          value={formatHours(d.averageTurnaroundHours)}
          icon={<Clock className="h-4 w-4" />}
          tone="success"
        />
        <InfoCard
          label="Active Reviewers"
          value={d.activeApproversCount}
          icon={<Users className="h-4 w-4" />}
          tone="accent"
        />
      </section>

      {/* Activity Trend */}
      <MultiSeriesBarChart
        title="Staff Decisions Trend"
        description="Daily approvals and rejections handled by staff members over the selected period."
        data={d.activityTrend}
        series={STAFF_DECISION_SERIES}
      />

      {/* Role Breakdown & Decision Distribution */}
      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart
          title="Decisions by Role"
          description="Total approval actions handled by each staff role."
          data={d.byRole.map((r) => ({ name: r.role, count: r.totalDecisions }))}
        />
        <LeaveTypePieChart
          title="Decision Distribution"
          data={d.byDecision}
        />
      </div>

      {/* Turnaround Time by Role */}
      {d.byRole.some((r) => r.averageTurnaroundHours != null) && (
        <AnalyticsBarChart
          title="Avg Turnaround Time by Role (Hours)"
          description="Average hours from submission to decision by staff role."
          data={d.byRole.map((r) => ({
            name: r.role,
            count: r.averageTurnaroundHours ?? 0,
          }))}
        />
      )}

      {/* Approver Activity Table */}
      <Card className="rounded-2xl border border-border bg-surface shadow-sm">
        <CardHeader>
          <CardTitle className="text-h3 font-semibold">Staff Reviewer Activity</CardTitle>
          <CardDescription className="text-body text-muted">
            Individual throughput and average decision turnaround times for staff members who acted during this period.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.approvers.length === 0 ? (
            <p className="py-8 text-center text-body text-muted">No staff decisions recorded for this period.</p>
          ) : (
            <TableScroll>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Approved</TableHead>
                    <TableHead className="text-right">Rejected</TableHead>
                    <TableHead className="text-right">Total Decisions</TableHead>
                    <TableHead className="text-right">Avg Turnaround</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.approvers.map((approver) => (
                    <TableRow key={`${approver.userId}-${approver.role}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar name={approver.name} size="sm" />
                          <span>{approver.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge tone="neutral" size="sm">
                          {approver.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-success">
                        {approver.approvedCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-danger">
                        {approver.rejectedCount}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-ink">
                        {approver.totalDecisions}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-muted">
                        {formatHours(approver.averageTurnaroundHours)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default StaffTab;
