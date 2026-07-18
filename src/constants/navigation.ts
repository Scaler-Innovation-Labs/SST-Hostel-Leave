import {
  BarChart3,
  Bell,
  ClipboardList,
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

export const NAVIGATION = {
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
      label: "My Leaves",
      href: ROUTES.STUDENT_LEAVES,
      icon: FileText,
    },
    {
      label: "New Leave",
      href: ROUTES.STUDENT_LEAVE_NEW,
      icon: FileText,
    },
    {
      label: "QR Pass",
      href: ROUTES.STUDENT_QR,
      icon: QrCode,
    },
  ],

  admin: [
    {
      label: "Approvals",
      href: ROUTES.ADMIN_APPROVALS,
      icon: FileText,
    },
    {
      label: "Movement History",
      href: ROUTES.ADMIN_MOVEMENTS,
      icon: LayoutDashboard,
    },
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
    {
      label: "POC Dashboard",
      href: ROUTES.POC_DASHBOARD,
      icon: LayoutDashboard,
    },
    {
      label: "POC Approvals",
      href: ROUTES.POC_APPROVALS,
      icon: FileText,
    },
  ],

  poc: [
    {
      label: "Dashboard",
      href: ROUTES.POC_DASHBOARD,
      icon: LayoutDashboard,
    },
    {
      label: "Approvals",
      href: ROUTES.POC_APPROVALS,
      icon: FileText,
    },
  ],

  guard: [
    {
      label: "Scanner",
      href: ROUTES.GUARD_SCANNER,
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
      label: "Approvals",
      href: ROUTES.SUPER_ADMIN_APPROVALS,
      icon: FileText,
    },
    {
      label: "Extension Approvals",
      href: ROUTES.SUPER_ADMIN_EXTENSION_APPROVALS,
      icon: FileText,
    },
    {
      label: "Workflows",
      href: ROUTES.SUPER_ADMIN_WORKFLOWS,
      icon: Workflow,
    },
    {
      label: "Policies",
      href: ROUTES.SUPER_ADMIN_POLICIES,
      icon: ShieldCheck,
    },
    {
      label: "Leave Types",
      href: ROUTES.SUPER_ADMIN_LEAVE_TYPES,
      icon: ClipboardList,
    },
    {
      label: "Users",
      href: ROUTES.SUPER_ADMIN_USERS,
      icon: Users,
    },
    {
      label: "Students",
      href: ROUTES.SUPER_ADMIN_STUDENTS,
      icon: Users,
    },
    {
      label: "Parents",
      href: ROUTES.SUPER_ADMIN_PARENTS,
      icon: ShieldCheck,
    },
    {
      label: "Notification Templates",
      href: ROUTES.SUPER_ADMIN_TEMPLATES,
      icon: Bell,
    },
    {
      label: "Notification Rules",
      href: ROUTES.SUPER_ADMIN_NOTIFICATION_RULES,
      icon: Bell,
    },
    {
      label: "Delivery Logs",
      href: ROUTES.SUPER_ADMIN_DELIVERY_LOGS,
      icon: Bell,
    },
    {
      label: "Settings",
      href: ROUTES.SUPER_ADMIN_SETTINGS,
      icon: Settings,
    },
  ],
};
