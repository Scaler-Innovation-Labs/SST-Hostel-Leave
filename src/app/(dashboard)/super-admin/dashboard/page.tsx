"use client";

import { BarChart3, Users } from "lucide-react";

import { StaffDashboard, type StaffQuickAction } from "@/features/dashboard/components/StaffDashboard";

const EXTRA_ACTIONS: StaffQuickAction[] = [
  {
    label: "Manage Users",
    description: "Assign roles and permissions",
    href: "/super-admin/users",
    icon: Users,
    tone: "text-accent bg-accent-light",
  },
  {
    label: "Analytics",
    description: "Trends, breakdowns and reports",
    href: "/super-admin/analytics",
    icon: BarChart3,
    tone: "text-accent bg-accent-light",
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
