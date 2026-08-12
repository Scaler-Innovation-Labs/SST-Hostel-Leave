"use client";

import useSWR from "swr";

import { CountBadge } from "@/components/shared/CountBadge";

/**
 * Live count of overdue returns (students checked out past their leave end
 * date), shown on the Overdue nav item. Scoped to the current user's hostels
 * by the API.
 */
export function OverdueCountBadge({ className }: { className?: string }) {
  const { data } = useSWR("/api/v1/overdue", { refreshInterval: 15_000 });

  const items = Array.isArray(data?.data) ? (data.data as unknown[]) : [];
  const count = items.length;

  return <CountBadge count={count} tone="red" className={className} />;
}
