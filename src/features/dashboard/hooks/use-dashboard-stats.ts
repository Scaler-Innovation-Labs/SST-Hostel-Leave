"use client";

import useSWR from "swr";

import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { DashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { getDashboardStatsUrl } from "@/lib/api/dashboard-api";

export function useDashboardStats(
  status?: string,
  period?: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
) {
  const { data, error, isLoading, mutate } = useSWR<{ data: DashboardStats }>(
    getDashboardStatsUrl(status, period, startDate, endDate),
    {
      refreshInterval: 180_000,
      dedupingInterval: 30_000,
      revalidateIfStale: false,
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
