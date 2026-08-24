"use client";

import useSWR from "swr";

import { CountBadge } from "@/components/shared/CountBadge";

/**
 * Live count of overdue returns (students checked out past their leave end
 * date), shown on the Overdue nav item. Scoped to the current user's hostels
 * by the API.
 *
 * Uses the dedicated /overdue/count endpoint (COUNT(*) only) — the full list
 * payload shipped 200 rows to render a single number. Polls at 60s; SWR's
 * default refreshWhenHidden=false pauses polling in background tabs.
 */
export function OverdueCountBadge({ className }: { className?: string }) {
  const { data } = useSWR<{ data: { count: number } }>("/api/v1/overdue/count", {
    refreshInterval: 60_000,
  });

  const count = data?.data?.count ?? 0;

  return <CountBadge count={count} tone="red" className={className} />;
}
