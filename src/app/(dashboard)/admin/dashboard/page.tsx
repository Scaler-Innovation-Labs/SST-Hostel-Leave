"use client";

import Link from "next/link";

import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import type { StaffDashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { useDashboardStats } from "@/features/dashboard/hooks/use-dashboard-stats";

export default function AdminDashboardPage() {
  const { stats, isLoading, isError, mutate } = useDashboardStats();

  if (isLoading) return <LoadingState count={4} />;
  if (isError) return <ErrorState message="Failed to load dashboard" onRetry={() => mutate()} />;

  const s = stats as StaffDashboardStats;
  const pendingApprovals = s.pendingApprovals;
  const activeStudents = s.activeStudents;
  const studentsOutside = s.studentsOutside;
  const overdueStudents = s.overdueStudents;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin Dashboard"
        description="Manage leave approvals and movement workflows."
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Pending Approvals" value={pendingApprovals} />
        <InfoCard label="Active Students" value={activeStudents} />
        <InfoCard label="Outside Hostel" value={studentsOutside} />
        <InfoCard label="Overdue" value={overdueStudents} />
      </section>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-base font-semibold">Quick Actions</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href={ROUTES.ADMIN_APPROVALS}>
            <Button>Review Approvals</Button>
          </Link>
          <Link href={ROUTES.ADMIN_STUDENTS}>
            <Button variant="outline">View Students</Button>
          </Link>
          <Link href={ROUTES.ADMIN_MOVEMENTS}>
            <Button variant="outline">Movement History</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
