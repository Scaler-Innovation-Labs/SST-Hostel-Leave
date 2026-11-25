"use client";

import { CalendarX, Clock, QrCode, TimerOff } from "lucide-react";

import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { MultiSeriesBarChart } from "@/components/analytics/MultiSeriesBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CHART } from "@/design-system/sst";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { ExpiredAnalytics } from "@/dto/analytics/expired-analytics.dto";
import { useExpiredAnalytics } from "@/features/analytics/hooks/use-analytics";

type ExpiredTabProps = {
  period: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
};

export function ExpiredTab({ period, startDate, endDate }: ExpiredTabProps) {
  const { data, isLoading, isError, mutate } = useExpiredAnalytics(period, startDate, endDate);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) {
    return <ErrorState message="Failed to load expired analytics" onRetry={() => mutate()} />;
  }

  const d = data as ExpiredAnalytics;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard
          label="Total Expired"
          value={d.totalExpired}
          icon={<TimerOff className="h-4 w-4" />}
          tone="accent"
        />
        <InfoCard
          label="Expired Leaves"
          value={d.expiredLeaves}
          icon={<CalendarX className="h-4 w-4" />}
          tone="warning"
        />
        <InfoCard
          label="Expired Extensions"
          value={d.expiredExtensions}
          icon={<Clock className="h-4 w-4" />}
          tone="danger"
        />
        <InfoCard
          label="Expired QR Passes"
          value={d.expiredQrPasses}
          icon={<QrCode className="h-4 w-4" />}
          tone="accent"
        />
      </section>

      <MultiSeriesBarChart
        title="Expired Leaves Trend"
        description="Daily expired leave requests over the selected period."
        data={d.expiredTrend.map((point) => ({ date: point.date, count: point.value }))}
        series={[{ key: "count", label: "Expired", color: CHART.warning }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaveTypePieChart title="Expiration Reasons" data={d.byReason} />
        <LeaveTypePieChart title="Expired by Leave Type" data={d.byLeaveType} />
      </div>

      <Tabs defaultValue="reason" className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <TabsList>
          <TabsTrigger value="reason">By Reason</TabsTrigger>
          <TabsTrigger value="hostel">By Hostel</TabsTrigger>
          <TabsTrigger value="department">By Department</TabsTrigger>
        </TabsList>
        <TabsContent value="reason">
          <AnalyticsBarChart
            title="Expired Leaves by Reason"
            description="Why leave requests expired across the selected period."
            data={d.byReason}
            height={300}
          />
        </TabsContent>
        <TabsContent value="hostel">
          <AnalyticsBarChart
            title="Expired Leaves by Hostel"
            description="Expired requests across hostels."
            data={d.byHostel}
            height={300}
          />
        </TabsContent>
        <TabsContent value="department">
          <AnalyticsBarChart
            title="Expired Leaves by Department"
            description="Expired requests across academic departments."
            data={d.byDepartment}
            height={300}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ExpiredTab;
