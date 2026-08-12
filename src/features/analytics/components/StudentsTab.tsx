"use client";

import { Building2, CalendarClock, GraduationCap, Users } from "lucide-react";

import { AnalyticsAreaChart } from "@/components/analytics/AreaChart";
import { AnalyticsBarChart } from "@/components/analytics/BarChart";
import { LeaveTypePieChart } from "@/components/analytics/LeaveTypePieChart";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { StudentAnalytics } from "@/dto/analytics/student-analytics.dto";
import { useStudentAnalytics } from "@/features/analytics/hooks/use-analytics";

type StudentsTabProps = {
  period: AnalyticsPeriod;
};

export function StudentsTab({ period }: StudentsTabProps) {
  const { data, isLoading, isError, mutate } = useStudentAnalytics(period);

  if (isLoading && !data) return <LoadingState count={6} />;
  if (isError && !data) return <ErrorState message="Failed to load student analytics" onRetry={() => mutate()} />;

  const d = data as StudentAnalytics;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Total Students" value={d.totalStudents} icon={<Users className="h-4 w-4" />} tone="primary" />
        <InfoCard label="In Hostel" value={d.inHostel} icon={<Building2 className="h-4 w-4" />} tone="success" />
        <InfoCard label="On Leave" value={d.onLeave} icon={<CalendarClock className="h-4 w-4" />} tone="warning" />
        <InfoCard label="Overdue Returns" value={d.overdue} icon={<GraduationCap className="h-4 w-4" />} tone="danger" />
      </section>

      <AnalyticsAreaChart
        title="Active Students Trend"
        description="Daily count of active students over the selected period."
        data={d.trend.map((point) => ({ date: point.date, value: point.value }))}
        color="#6366f1"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart title="Students by Hostel" description="Distribution of students across hostels." data={d.byHostel} />
        <LeaveTypePieChart title="Students by Gender" data={d.byGender} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AnalyticsBarChart title="Students by Department" description="Distribution of students across departments." data={d.byDepartment} />
        <AnalyticsBarChart title="Students by Academic Group" description="Distribution across classes, sections and batches." data={d.byAcademicGroup} />
      </div>
    </div>
  );
}

export default StudentsTab;