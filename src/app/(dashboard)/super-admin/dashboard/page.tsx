"use client";

import { BarChart3, Users } from "lucide-react";

import { StaffDashboard, type StaffQuickAction } from "@/features/dashboard/components/StaffDashboard";

const EXTRA_ACTIONS: StaffQuickAction[] = [
  {
    label: "Manage Users",
    description: "Assign roles and permissions",
    href: "/super-admin/users",
    icon: Users,
    tone: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
  },
  {
    label: "Analytics",
    description: "Trends, breakdowns and reports",
    href: "/super-admin/analytics",
    icon: BarChart3,
    tone: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-400",
  },
];

export default function SuperAdminDashboardPage() {
  return (
    <StaffDashboard
      basePath="/super-admin"
      title="Super Admin Dashboard"
      description="System-wide overview and management."
      extraActions={EXTRA_ACTIONS}
    />
  );
}
