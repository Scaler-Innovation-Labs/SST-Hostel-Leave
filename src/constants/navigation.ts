import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  QrCode,
  Users,
  Settings,
  Workflow,
  BarChart3,
} from "lucide-react";

import React from "react";

export type NavigationItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export const navigation = {
  landing: [
    {
      label: "Features",
      href: "#features",
    },
    {
      label: "Workflow",
      href: "#workflow",
    },
  ],

  student: [
    {
      label: "Dashboard",
      href: "/student/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "New Leave",
      href: "/student/leave/new",
      icon: FileText,
    },
    {
      label: "Policies",
      href: "/student/policies",
      icon: ShieldCheck,
    },
  ],

  admin: [
    {
      label: "Analytics",
      href: "/admin/analytics",
      icon: BarChart3,
    },
    {
      label: "Students",
      href: "/admin/students",
      icon: Users,
    },
    {
      label: "Scanner",
      href: "/admin/scanner",
      icon: QrCode,
    },
  ],

  superAdmin: [
    {
      label: "Analytics",
      href: "/super-admin/analytics",
      icon: BarChart3,
    },
    {
      label: "Workflows",
      href: "/super-admin/workflows",
      icon: Workflow,
    },
    {
      label: "Users",
      href: "/super-admin/users",
      icon: Users,
    },
    {
      label: "Settings",
      href: "/super-admin/settings",
      icon: Settings,
    },
  ],
};