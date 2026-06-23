"use client";

import useSWR from "swr";

import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import { getApprovalsUrl } from "@/lib/api/approval-api";

export function useApprovals(query?: Partial<ListApprovalsQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getApprovalsUrl(query) : null,
    { refreshInterval: 30_000 },
  );

  return {
    approvals: data?.data?.items ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
