"use client";

import {
  BarChart3,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  GraduationCap,
  Hotel,
  Settings,
  ShieldCheck,
  Users,
  Workflow,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

export type SidebarItem = {
  label: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type SidebarSection = {
  title: string;
  items: SidebarItem[];
};

export const SIDEBAR_SECTIONS: SidebarSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Analytics", href: ROUTES.SUPER_ADMIN_ANALYTICS, icon: BarChart3 },
      { label: "Approvals", href: ROUTES.SUPER_ADMIN_APPROVALS, icon: FileText },
      {
        label: "Extension Approvals",
        href: ROUTES.SUPER_ADMIN_EXTENSION_APPROVALS,
        icon: FileText,
      },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Leave Types", href: ROUTES.SUPER_ADMIN_LEAVE_TYPES, icon: ClipboardList },
      { label: "Workflows", href: ROUTES.SUPER_ADMIN_WORKFLOWS, icon: Workflow },
      { label: "Policies", href: ROUTES.SUPER_ADMIN_POLICIES, icon: ShieldCheck },
      { label: "Hostels", href: ROUTES.SUPER_ADMIN_HOSTELS, icon: Hotel },
      { label: "Departments", href: ROUTES.SUPER_ADMIN_DEPARTMENTS, icon: Building2 },
      { label: "Academic Groups", href: ROUTES.SUPER_ADMIN_ACADEMIC_GROUPS, icon: GraduationCap },
    ],
  },
  {
    title: "Notifications",
    items: [
      { label: "Templates", href: ROUTES.SUPER_ADMIN_TEMPLATES, icon: Bell },
      { label: "Rules", href: ROUTES.SUPER_ADMIN_NOTIFICATION_RULES, icon: Bell },
      { label: "Delivery Logs", href: ROUTES.SUPER_ADMIN_DELIVERY_LOGS, icon: Bell },
    ],
  },
  {
    title: "People",
    items: [
      { label: "Users", href: ROUTES.SUPER_ADMIN_USERS, icon: Users },
      { label: "Students", href: ROUTES.SUPER_ADMIN_STUDENTS, icon: GraduationCap },
      { label: "Parents", href: ROUTES.SUPER_ADMIN_PARENTS, icon: ShieldCheck },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Settings", href: ROUTES.SUPER_ADMIN_SETTINGS, icon: Settings },
    ],
  },
];

type SidebarNavProps = {
  onNavigate?: () => void;
};

function SidebarNav({ onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <nav className="flex flex-col gap-6">
      {SIDEBAR_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {section.title}
          </p>
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-md",
                      active ? "bg-primary/15" : "bg-transparent",
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function SuperAdminSidebar() {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r md:border-border">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Image
          src="/logosst.png"
          alt="SST Logo"
          width={36}
          height={36}
          className="rounded-lg"
          priority
        />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold">SST Hostel</span>
          <span className="text-xs text-muted-foreground">Admin Panel</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav />
      </div>
    </aside>
  );
}

export function MobileSidebar({ onNavigate }: SidebarNavProps) {
  return (
    <div className="flex flex-col">
      <div className="flex h-16 items-center gap-3 border-b border-border px-4">
        <Image
          src="/logosst.png"
          alt="SST Logo"
          width={36}
          height={36}
          className="rounded-lg"
          priority
        />
        <div className="flex flex-col leading-none">
          <span className="text-sm font-semibold">SST Hostel</span>
          <span className="text-xs text-muted-foreground">Admin Panel</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <SidebarNav onNavigate={onNavigate} />
      </div>
    </div>
  );
}
