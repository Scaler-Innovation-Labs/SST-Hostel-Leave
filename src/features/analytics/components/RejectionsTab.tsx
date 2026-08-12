"use client";

import { ShieldX, ThumbsDown, UserX } from "lucide-react";

import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { MultiSeriesBarChart } from "@/components/analytics/MultiSeriesBarChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { RejectionAnalytics } from "@/dto/analytics/rejection-analytics.dto";
import { useRejectionAnalytics } from "@/features/analytics/hooks/use-analytics";

type RejectionsTabProps = {
  period: AnalyticsPeriod;
};

export function RejectionsTab({ period }: RejectionsTabProps) {
  const { data, isLoading, isError, mutate } = useRejectionAnalytics(period);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) return <ErrorState message="Failed to load rejection analytics" onRetry={() => mutate()} />;

  const d = data as RejectionAnalytics;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Total Rejections" value={d.totalRejections} icon={<ThumbsDown className="h-4 w-4" />} tone="primary" />
        <InfoCard label="Policy Rejections" value={d.policyRejections} icon={<ShieldX className="h-4 w-4" />} tone="warning" />
        <InfoCard label="Human Rejections" value={d.humanRejections} icon={<UserX className="h-4 w-4" />} tone="danger" />
      </section>

      <MultiSeriesBarChart
        title="Rejections Trend"
        description="Daily rejections over the selected period."
        data={d.rejectionTrend.map((point) => ({ date: point.date, count: point.value }))}
        series={[{ key: "count", label: "Rejections", color: "#ef4444" }]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <LeaveTypePieChart title="Rejections by Source" data={d.bySource} />
        <LeaveTypePieChart title="Rejections by Leave Type" data={d.byLeaveType} />
      </div>

      <Tabs defaultValue="category" className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <TabsList>
          <TabsTrigger value="category">By Reason</TabsTrigger>
          <TabsTrigger value="hostel">By Hostel</TabsTrigger>
        </TabsList>
        <TabsContent value="category">
          <AnalyticsBarChart
            title="Rejections by Reason"
            description="Breakdown of rejection reasons."
            data={d.byCategory}
            height={300}
          />
        </TabsContent>
        <TabsContent value="hostel">
          <AnalyticsBarChart
            title="Rejections by Hostel"
            description="Rejections across hostels."
            data={d.byHostel}
            height={300}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default RejectionsTab;