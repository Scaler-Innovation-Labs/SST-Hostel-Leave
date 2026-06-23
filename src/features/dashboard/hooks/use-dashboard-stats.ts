"use client";

import useSWR from "swr";

import type { DashboardStats } from "@/dto/dashboard/dashboard-stats.dto";
import { getDashboardStatsUrl } from "@/lib/api/dashboard-api";

export function useDashboardStats() {
  const { data, error, isLoading, mutate } = useSWR<{ data: DashboardStats }>(getDashboardStatsUrl(), { refreshInterval: 60_000 });

  return {
    stats: data?.data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
