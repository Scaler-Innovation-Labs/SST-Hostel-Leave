"use client";

import React, { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import { LeavesTab } from "@/features/analytics/components/LeavesTab";
import { MovementQrTab } from "@/features/analytics/components/MovementQrTab";
import { PeriodSelect } from "@/features/analytics/components/PeriodSelect";
import { RejectionsTab } from "@/features/analytics/components/RejectionsTab";
import { StaffTab } from "@/features/analytics/components/StaffTab";
import { StudentsTab } from "@/features/analytics/components/StudentsTab";

function formatDateInput(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

type AnalyticsShellProps = {
  description: string;
  /** Extra content rendered above the tabs (e.g. role-specific KPIs). */
  headerExtra?: React.ReactNode;
  /** The legacy overall dashboard-stats view rendered in the first tab. */
  overall?: React.ReactNode;
};

export function AnalyticsShell({ description, headerExtra, overall }: AnalyticsShellProps) {
  const [activeTab, setActiveTab] = useState(overall ? "overall" : "students");
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatDateInput(d);
  });
  const [customEndDate, setCustomEndDate] = useState(() => formatDateInput(new Date()));

  const startDate = period === "custom" ? customStartDate : undefined;
  const endDate = period === "custom" ? customEndDate : undefined;

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageHeader title="Analytics" description={description} />
          {headerExtra}
        </div>
        <PeriodSelect
          value={period}
          onChange={setPeriod}
          startDate={customStartDate}
          endDate={customEndDate}
          onStartDateChange={setCustomStartDate}
          onEndDateChange={setCustomEndDate}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {overall && <TabsTrigger value="overall">Overall</TabsTrigger>}
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="movement">Movement &amp; QR</TabsTrigger>
          <TabsTrigger value="rejections">Rejections</TabsTrigger>
          <TabsTrigger value="staff">Staff</TabsTrigger>
        </TabsList>

        {overall && (
          <TabsContent value="overall">
            {React.isValidElement(overall)
              ? React.cloneElement(overall, {
                  period,
                  startDate,
                  endDate,
                } as Record<string, unknown>)
              : overall}
          </TabsContent>
        )}
        <TabsContent value="students">
          <StudentsTab period={period} startDate={startDate} endDate={endDate} />
        </TabsContent>
        <TabsContent value="leaves">
          <LeavesTab period={period} startDate={startDate} endDate={endDate} />
        </TabsContent>
        <TabsContent value="movement">
          <MovementQrTab period={period} startDate={startDate} endDate={endDate} />
        </TabsContent>
        <TabsContent value="rejections">
          <RejectionsTab period={period} startDate={startDate} endDate={endDate} />
        </TabsContent>
        <TabsContent value="staff">
          <StaffTab period={period} startDate={startDate} endDate={endDate} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsShell;
