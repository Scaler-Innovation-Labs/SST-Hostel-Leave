"use client";

import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Hourglass,
  ListChecks,
  LogOut,
  Route,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatProgress } from "@/components/shared/StatProgress";
import type { StaffDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";
import { cn } from "@/lib/utils";

export type StaffQuickAction = {
  label: string;
  description: string;
  href: string;
  icon: typeof ListChecks;
  tone: string;
  count?: number;
};

type StaffDashboardProps = {
  basePath: string;
  title: string;
  description: string;
  /** Extra quick actions appended after the standard ones (e.g. role-specific pages). */
  extraActions?: StaffQuickAction[];
};

function defaultActions(basePath: string): StaffQuickAction[] {
  return [
    {
      label: "Review Approvals",
      description: "Pending leave requests",
      href: `${basePath}/approvals`,
      icon: ListChecks,
      tone: "text-primary bg-primary/10",
    },
    {
      label: "Extension Approvals",
      description: "Pending extension requests",
      href: `${basePath}/extension-approvals`,
      icon: CalendarClock,
      tone: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
    },
    {
      label: "Overdue Returns",
      description: "Students marked overdue",
      href: `${basePath}/overdue`,
      icon: AlertTriangle,
      tone: "text-red-600 bg-red-500/10 dark:text-red-400",
    },
    {
      label: "View Students",
      description: "Browse student profiles",
      href: `${basePath}/students`,
      icon: Users,
      tone: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      label: "Movement History",
      description: "Recent entry/exit events",
      href: `${basePath}/movements`,
      icon: Route,
      tone: "text-amber-600 bg-amber-500/10 dark:text-amber-400",
    },
  ];
}

function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </div>
  );
}

export function StaffDashboard({ basePath, title, description, extraActions = [] }: StaffDashboardProps) {
  const { stats, isLoading, isError, mutate } = useDashboardStats();

  if (isLoading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message="Failed to load dashboard" onRetry={() => mutate()} />;

  const s = stats as StaffDashboardStats;
  const pendingTotal = s.pendingApprovals + s.pendingExtensions;

  const actions = [...defaultActions(basePath), ...extraActions];
  const counts: Record<string, number> = {
    [`${basePath}/approvals`]: s.pendingApprovals,
    [`${basePath}/extension-approvals`]: s.pendingExtensions,
    [`${basePath}/overdue`]: s.overdueStudents,
  };
  const withCount = actions.map((action) => ({
    ...action,
    count: counts[action.href] ?? 0,
  }));

  return (
    <div className="space-y-8">
      <PageHeader title={title} description={description} />

      <section>
        <SectionHeader title="Students">
          <StatProgress
            label="Occupancy"
            value={s.activeStudents}
            total={s.totalStudents}
            tone="success"
            className="w-40"
          />
        </SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            label="Total Students"
            value={s.totalStudents}
            icon={<Users className="h-4 w-4" />}
            tone="primary"
          />
          <InfoCard
            label="Active Students"
            value={s.activeStudents}
            icon={<UserCheck className="h-4 w-4" />}
            tone="success"
          />
          <InfoCard
            label="Students on Leave"
            value={s.studentsOnLeave}
            icon={<LogOut className="h-4 w-4" />}
            tone="warning"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Approvals">
          <StatProgress
            label="Pending"
            value={pendingTotal}
            total={s.totalLeaves}
            tone="warning"
            className="w-40"
          />
        </SectionHeader>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <InfoCard
            label="Pending Approvals"
            value={s.pendingApprovals}
            icon={<Hourglass className="h-4 w-4" />}
            tone="warning"
          />
          <InfoCard
            label="Pending Extensions"
            value={s.pendingExtensions}
            icon={<CalendarClock className="h-4 w-4" />}
            tone="primary"
          />
          <InfoCard
            label="Overdue"
            value={s.overdueStudents}
            icon={<AlertTriangle className="h-4 w-4" />}
            tone="danger"
          />
        </div>
      </section>

      <section>
        <SectionHeader title="Quick Actions" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {withCount.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="group relative flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn("flex size-10 shrink-0 items-center justify-center rounded-lg", action.tone)}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{action.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </span>
                {typeof action.count === "number" && action.count > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                    {action.count}
                  </span>
                )}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
