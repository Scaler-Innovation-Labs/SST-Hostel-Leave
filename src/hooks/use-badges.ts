"use client";

import useSWR from "swr";

import { fetcher } from "@/lib/api/fetcher";

export type NavBadges = {
  approvals: number;
  extensionApprovals: number;
  overdue: number;
};

/**
 * Staff nav badge counts, aggregated server-side into one request.
 *
 * Replaces three independent pollers (approvals / extension approvals /
 * overdue) that each fired on every authenticated navigation — three
 * cold-lambda opportunities per page view instead of one.
 *
 * All badge components consume this same SWR key, so the request is
 * deduplicated across the sidebar for the lifetime of the page.
 */
export function useNavBadges(refreshInterval = 60_000) {
  const { data } = useSWR<NavBadges>("/api/v1/badges", fetcher, {
    refreshInterval,
  });

  return {
    badges: data,
    approvalsCount: data?.approvals ?? 0,
    extensionApprovalsCount: data?.extensionApprovals ?? 0,
    overdueCount: data?.overdue ?? 0,
  };
}
