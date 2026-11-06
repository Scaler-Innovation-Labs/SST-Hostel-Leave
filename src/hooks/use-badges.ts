"use client";

import useSWR, { type KeyedMutator } from "swr";

import { fetcher } from "@/lib/api/fetcher";

export type NavBadges = {
  approvals: number;
  extensionApprovals: number;
  overdue: number;
};

export const NAV_BADGES_SWR_KEY = "/api/v1/badges";
export const NAV_BADGES_POLL_INTERVAL = 300_000; // 5 minutes

export type UseNavBadgesOptions = {
  refreshInterval?: number;
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
};

/**
 * Staff nav badge counts, aggregated server-side into one request.
 *
 * All badge components consume this same SWR key, so the request is
 * deduplicated across the sidebar for the lifetime of the page.
 *
 * Configured with 300s polling and revalidateOnFocus: true so that staff
 * returning to the tab immediately see fresh pending and overdue counts.
 */
export function useNavBadges(
  optionsOrInterval?: number | UseNavBadgesOptions
): {
  badges: NavBadges | undefined;
  approvalsCount: number;
  extensionApprovalsCount: number;
  overdueCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<NavBadges>;
} {
  const opts =
    typeof optionsOrInterval === "number"
      ? { refreshInterval: optionsOrInterval }
      : optionsOrInterval;

  const { data, error, isLoading, mutate } = useSWR<NavBadges>(
    NAV_BADGES_SWR_KEY,
    fetcher,
    {
      refreshInterval: opts?.refreshInterval ?? NAV_BADGES_POLL_INTERVAL,
      dedupingInterval: opts?.dedupingInterval ?? 30_000,
      revalidateOnFocus: opts?.revalidateOnFocus ?? true,
    }
  );

  return {
    badges: data,
    approvalsCount: data?.approvals ?? 0,
    extensionApprovalsCount: data?.extensionApprovals ?? 0,
    overdueCount: data?.overdue ?? 0,
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}
