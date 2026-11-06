"use client";

import useSWR from "swr";

import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { DashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { getDashboardStatsUrl } from "@/lib/api/dashboard-api";

export const DASHBOARD_STATS_POLL_INTERVAL = 180_000; // 3 minutes

export type UseDashboardStatsOptions = {
  enabled?: boolean;
  refreshInterval?: number;
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
};

export function useDashboardStats(
  status?: string,
  period?: AnalyticsPeriod,
  startDate?: string,
  endDate?: string,
  options?: UseDashboardStatsOptions
) {
  const enabled = options?.enabled ?? true;
  const { data, error, isLoading, mutate } = useSWR<{ data: DashboardStats }>(
    enabled ? getDashboardStatsUrl(status, period, startDate, endDate) : null,
    {
      refreshInterval: options?.refreshInterval ?? DASHBOARD_STATS_POLL_INTERVAL,
      dedupingInterval: options?.dedupingInterval ?? 30_000,
      revalidateIfStale: false,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
      keepPreviousData: true,
    }
  );

  return {
    stats: data?.data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
