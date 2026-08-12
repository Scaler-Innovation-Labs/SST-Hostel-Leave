"use client";

import { Activity, AlertTriangle, Clock, QrCode, ScanLine, ShieldCheck, Users } from "lucide-react";

import { AnalyticsAreaChart } from "@/components/analytics/AreaChart";
import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { MultiSeriesBarChart, type SeriesDef } from "@/components/analytics/MultiSeriesBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { MovementAnalytics, ScanTrendPoint } from "@/dto/analytics/movement-analytics.dto";
import { useMovementAnalytics } from "@/features/analytics/hooks/use-analytics";

const SCAN_SERIES: SeriesDef[] = [
  { key: "success", label: "Success", color: "#10b981" },
  { key: "failed", label: "Failed", color: "#ef4444" },
];

const toScanData = (rows: ScanTrendPoint[]): Array<Record<string, string | number>> =>
  rows.map((row) => ({ date: row.date, success: row.success, failed: row.failed }));

type MovementQrTabProps = {
  period: AnalyticsPeriod;
};

export function MovementQrTab({ period }: MovementQrTabProps) {
  const { data, isLoading, isError, mutate } = useMovementAnalytics(period);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) return <ErrorState message="Failed to load movement analytics" onRetry={() => mutate()} />;

  const d = data as MovementAnalytics;
  const totalScans = d.scanSuccess + d.scanFailed;
  const successRate = totalScans > 0 ? Math.round((d.scanSuccess / totalScans) * 100) : 0;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Movement Events" value={d.totalMovementEvents} icon={<Activity className="h-4 w-4" />} tone="primary" />
        <InfoCard label="Total QR Passes" value={d.totalQrPasses} icon={<QrCode className="h-4 w-4" />} tone="success" />
        <InfoCard label="Active QR Passes" value={d.activeQrPasses} icon={<ShieldCheck className="h-4 w-4" />} tone="warning" />
        <InfoCard label="Overdue Returns" value={d.overdueReturns} icon={<AlertTriangle className="h-4 w-4" />} tone="danger" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3 xl:grid-cols-4">
        <InfoCard label="QR Scans" value={totalScans} icon={<ScanLine className="h-4 w-4" />} />
        <InfoCard label="Success Rate" value={`${successRate}%`} icon={<Users className="h-4 w-4" />} tone="success" />
        <InfoCard label="Failed Scans" value={d.scanFailed} icon={<Clock className="h-4 w-4" />} tone="danger" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsAreaChart
          title="Movement Events Trend"
          description="Daily movement events over the selected period."
          data={d.movementTrend.map((point) => ({ date: point.date, value: point.value }))}
          color="#6366f1"
        />
        <MultiSeriesBarChart
          title="QR Scan Results"
          description="Daily successful vs failed QR scans."
          data={toScanData(d.scanTrend)}
          series={SCAN_SERIES}
          stacked
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart title="Movement Events by Type" description="Distribution by movement event type." data={d.byEventType} />
        <AnalyticsBarChart title="Movement by Method" description="Distribution by movement method (QR, walk-in, etc.)." data={d.byMovementMethod} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaveTypePieChart title="QR Passes by Status" data={d.qrByStatus} />
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
          <h3 className="mb-1 text-base font-semibold">Top Scan Failure Reasons</h3>
          <p className="mb-4 text-sm text-muted-foreground">Most common reasons QR scans are rejected.</p>
          {d.topFailureReasons.length === 0 ? (
            <div className="flex h-[220px] items-center justify-center">
              <p className="text-sm text-muted-foreground">No failure reasons recorded.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {d.topFailureReasons.map((item) => (
                <li key={item.reason} className="flex items-center justify-between gap-4">
                  <span className="truncate text-sm text-muted-foreground">{item.reason}</span>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
                    {item.count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export default MovementQrTab;