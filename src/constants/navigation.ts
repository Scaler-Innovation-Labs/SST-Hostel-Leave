import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  CalendarPlus,
  ClipboardList,
  Clock,
  FileText,
  FolderTree,
  GraduationCap,
  History,
  Landmark,
  LayoutDashboard,
  Mail,
  Scale,
  ScanLine,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import type React from "react";

import { ROUTES } from "./routes";

export type NavigationItem = {
  label: string;
  href: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

/**
 * Grouping is the point.
 *
 * The super-admin console has seventeen destinations. A horizontal strip could
 * not hold them — they rendered inside a scrolling box with most of them
 * off-screen. A vertical column has the room, and the group headings are what
 * make seventeen scannable rather than a list to read top to bottom.
 */
export type NavigationGroup = {
  heading: string;
  items: NavigationItem[];
};

/** Anchors on the marketing page — not destinations, so no icons. */
export const LANDING_NAV = [
  { label: "Features", href: "#features" },
  { label: "Workflow", href: "#workflow" },
  { label: "Preview", href: "#security" },
] as const;

const STUDENT: NavigationGroup[] = [
  {
    heading: "Leave",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.STUDENT_DASHBOARD,
        Icon: LayoutDashboard,
      },
      { label: "My leaves", href: ROUTES.STUDENT_LEAVES, Icon: FileText },
      {
        label: "Request leave",
        href: ROUTES.STUDENT_LEAVE_NEW,
        Icon: CalendarPlus,
      },
    ],
  },
];

const ADMIN: NavigationGroup[] = [
  {
    heading: "Overview",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.ADMIN_DASHBOARD,
        Icon: LayoutDashboard,
      },
      { label: "Analytics", href: ROUTES.ADMIN_ANALYTICS, Icon: BarChart3 },
    ],
  },
  {
    heading: "Queues",
    items: [
      {
        label: "Approvals",
        href: ROUTES.ADMIN_APPROVALS,
        Icon: ClipboardList,
      },
      {
        label: "Extensions",
        href: ROUTES.ADMIN_EXTENSION_APPROVALS,
        Icon: Clock,
      },
      { label: "Overdue", href: ROUTES.ADMIN_OVERDUE, Icon: AlertTriangle },
    ],
  },
  {
    heading: "Activity",
    items: [
      { label: "Movements", href: ROUTES.ADMIN_MOVEMENTS, Icon: History },
    ],
  },
  {
    heading: "Directory",
    items: [{ label: "Students", href: ROUTES.ADMIN_STUDENTS, Icon: Users }],
  },
];

const POC: NavigationGroup[] = [
  {
    heading: "Overview",
    items: [
      { label: "Dashboard", href: ROUTES.POC_DASHBOARD, Icon: LayoutDashboard },
    ],
  },
];

const GUARD: NavigationGroup[] = [
  {
    heading: "Gate",
    items: [{ label: "Scanner", href: ROUTES.GUARD_SCANNER, Icon: ScanLine }],
  },
];

const SUPER_ADMIN: NavigationGroup[] = [
  {
    heading: "Overview",
    items: [
      {
        label: "Dashboard",
        href: ROUTES.SUPER_ADMIN_DASHBOARD,
        Icon: LayoutDashboard,
      },
      {
        label: "Analytics",
        href: ROUTES.SUPER_ADMIN_ANALYTICS,
        Icon: BarChart3,
      },
    ],
  },
  {
    heading: "Queues",
    items: [
      {
        label: "Approvals",
        href: ROUTES.SUPER_ADMIN_APPROVALS,
        Icon: ClipboardList,
      },
      {
        label: "Extensions",
        href: ROUTES.SUPER_ADMIN_EXTENSION_APPROVALS,
        Icon: Clock,
      },
      {
        label: "Overdue",
        href: ROUTES.SUPER_ADMIN_OVERDUE,
        Icon: AlertTriangle,
      },
    ],
  },
  {
    heading: "Activity",
    items: [
      { label: "Movements", href: ROUTES.SUPER_ADMIN_MOVEMENTS, Icon: History },
    ],
  },
  {
    heading: "Directory",
    items: [
      { label: "Students", href: ROUTES.SUPER_ADMIN_STUDENTS, Icon: Users },
      { label: "Parents", href: ROUTES.SUPER_ADMIN_PARENTS, Icon: UsersRound },
      { label: "Staff", href: ROUTES.SUPER_ADMIN_USERS, Icon: ShieldCheck },
    ],
  },
  {
    heading: "Configuration",
    items: [
      {
        label: "Workflows",
        href: ROUTES.SUPER_ADMIN_WORKFLOWS,
        Icon: Workflow,
      },
      { label: "Policies", href: ROUTES.SUPER_ADMIN_POLICIES, Icon: Scale },
      {
        label: "Leave types",
        href: ROUTES.SUPER_ADMIN_LEAVE_TYPES,
        Icon: FolderTree,
      },
      { label: "Hostels", href: ROUTES.SUPER_ADMIN_HOSTELS, Icon: Building2 },
      {
        label: "Departments",
        href: ROUTES.SUPER_ADMIN_DEPARTMENTS,
        Icon: Landmark,
      },
      {
        label: "Academic groups",
        href: ROUTES.SUPER_ADMIN_ACADEMIC_GROUPS,
        Icon: GraduationCap,
      },
    ],
  },
  {
    heading: "Notifications",
    items: [
      { label: "Templates", href: ROUTES.SUPER_ADMIN_TEMPLATES, Icon: Mail },
      {
        label: "Rules",
        href: ROUTES.SUPER_ADMIN_NOTIFICATION_RULES,
        Icon: Bell,
      },
      {
        label: "Delivery logs",
        href: ROUTES.SUPER_ADMIN_DELIVERY_LOGS,
        Icon: FileText,
      },
    ],
  },
  {
    heading: "System",
    items: [
      { label: "Settings", href: ROUTES.SUPER_ADMIN_SETTINGS, Icon: Settings },
    ],
  },
];

/**
 * Which console's navigation to render.
 *
 * Server components pass this key rather than the groups themselves: the items
 * carry Lucide icon *components*, and a function cannot cross the server/client
 * boundary. The client shell resolves the key against the map below.
 */
export type NavigationConsole =
  | "student"
  | "admin"
  | "poc"
  | "guard"
  | "superAdmin";

export const NAVIGATION: Record<NavigationConsole, NavigationGroup[]> = {
  student: STUDENT,
  admin: ADMIN,
  poc: POC,
  guard: GUARD,
  superAdmin: SUPER_ADMIN,
};

/**
 * The student's mobile bar. Thumb-reachable, at most five destinations, and
 * never a hamburger — a student on a phone between classes should not have to
 * open a menu to see where they are.
 */
export const STUDENT_BOTTOM_NAV: NavigationItem[] = STUDENT.flatMap(
  (group) => group.items
);
