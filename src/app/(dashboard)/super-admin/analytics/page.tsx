"use client";

import { Users } from "lucide-react";

import { AnalyticsShell } from "@/features/analytics/components/AnalyticsShell";
import { StaffAnalytics } from "@/features/dashboard/components/StaffAnalytics";

export default function SuperAdminAnalyticsPage() {
  return (
    <AnalyticsShell
      description="System-wide statistics and metrics for leave and movement management."
      overall={
        <StaffAnalytics
          description="System-wide statistics and metrics for leave and movement management."
          hidePageHeader
          extraCards={[
            {
              label: "Total Users",
              valueKey: "totalUsers",
              icon: <Users className="h-4 w-4" />,
              tone: "primary",
            },
          ]}
        />
      }
    />
  );
}