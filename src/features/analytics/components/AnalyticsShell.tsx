"use client";

import type React from "react";
import { useState } from "react";

import { PageHeader } from "@/components/shared/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import { LeavesTab } from "@/features/analytics/components/LeavesTab";
import { MovementQrTab } from "@/features/analytics/components/MovementQrTab";
import { PeriodSelect } from "@/features/analytics/components/PeriodSelect";
import { RejectionsTab } from "@/features/analytics/components/RejectionsTab";
import { StudentsTab } from "@/features/analytics/components/StudentsTab";

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <PageHeader title="Analytics" description={description} />
          {headerExtra}
        </div>
        {activeTab !== "overall" && <PeriodSelect value={period} onChange={setPeriod} />}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {overall && <TabsTrigger value="overall">Overall</TabsTrigger>}
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="movement">Movement &amp; QR</TabsTrigger>
          <TabsTrigger value="rejections">Rejections</TabsTrigger>
        </TabsList>

        {overall && (
          <TabsContent value="overall">
            {overall}
          </TabsContent>
        )}
        <TabsContent value="students">
          <StudentsTab period={period} />
        </TabsContent>
        <TabsContent value="leaves">
          <LeavesTab period={period} />
        </TabsContent>
        <TabsContent value="movement">
          <MovementQrTab period={period} />
        </TabsContent>
        <TabsContent value="rejections">
          <RejectionsTab period={period} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default AnalyticsShell;