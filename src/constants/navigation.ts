import {
  BarChart3,
  FileText,
  LayoutDashboard,
  QrCode,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import type React from "react";

import { ROUTES } from "./routes";

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
      href: ROUTES.STUDENT_DASHBOARD,
      icon: LayoutDashboard,
    },
    {
      label: "New Leave",
      href: ROUTES.STUDENT_LEAVE_NEW,
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
      href: ROUTES.ADMIN_ANALYTICS,
      icon: BarChart3,
    },
    {
      label: "Students",
      href: ROUTES.ADMIN_STUDENTS,
      icon: Users,
    },
    {
      label: "Scanner",
      href: ROUTES.ADMIN_SCANNER,
      icon: QrCode,
    },
  ],

  superAdmin: [
    {
      label: "Analytics",
      href: ROUTES.SUPER_ADMIN_ANALYTICS,
      icon: BarChart3,
    },
    {
      label: "Workflows",
      href: ROUTES.SUPER_ADMIN_WORKFLOWS,
      icon: Workflow,
    },
    {
      label: "Users",
      href: ROUTES.SUPER_ADMIN_USERS,
      icon: Users,
    },
    {
      label: "Settings",
      href: ROUTES.SUPER_ADMIN_SETTINGS,
      icon: Settings,
    },
  ],
};