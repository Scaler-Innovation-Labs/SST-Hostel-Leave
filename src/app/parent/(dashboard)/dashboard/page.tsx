"use client";

import useSWR from "swr";

import { ROUTES } from "@/constants/routes";
import { ErrorState } from "@/components/shared/ErrorState";
import { InfoCard } from "@/components/shared/InfoCard";
import { LoadingState } from "@/components/shared/LoadingState";
import { PageHeader } from "@/components/shared/PageHeader";

type ParentDashboardStats = {
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ParentDashboardPage() {
  const { data, isLoading, error, mutate } = useSWR(
    "/api/v1/parent/dashboard",
    fetcher,
    { refreshInterval: 60_000 }
  );

  if (isLoading) return <LoadingState count={4} />;

  if (error) {
    return (
      <ErrorState
        message="Failed to load dashboard"
        onRetry={() => mutate()}
      />
    );
  }

  const stats: ParentDashboardStats = data?.data ?? {};

  return (
    <div className="space-y-8">
      <PageHeader
        title="Parent Dashboard"
        description="Monitor your ward's leave activity and pending approvals."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <InfoCard label="Pending Approvals" value={stats.pendingCount} />
        <InfoCard label="Approved" value={stats.approvedCount} />
        <InfoCard label="Rejected" value={stats.rejectedCount} />
      </section>

      <QuickActions />
    </div>
  );
}

function QuickActions() {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h3 className="mb-4 text-base font-semibold">Quick Actions</h3>
      <div className="flex flex-wrap gap-3">
        <a
          href={ROUTES.PARENT_APPROVALS}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          View Pending Approvals
        </a>
        <a
          href={ROUTES.PARENT_HISTORY}
          className="rounded-lg bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground hover:bg-secondary/90"
        >
          View History
        </a>
      </div>
    </div>
  );
}
