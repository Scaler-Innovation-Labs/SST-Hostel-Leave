"use client";

import useSWR, { type KeyedMutator } from "swr";

import { fetcher } from "@/lib/api/fetcher";

export type HostelItem = {
  id: string;
  name: string;
  code: string;
  capacity: number | null;
  curfewStartTime: string | null;
  curfewEndTime: string | null;
  slackAdminGroupId: string | null;
  slackChannelId: string | null;
  isActive: boolean;
};

export const HOSTELS_SWR_KEY = "/api/v1/hostels";

export function useHostels() {
  const { data, error, isLoading, mutate } = useSWR<HostelItem[]>(
    HOSTELS_SWR_KEY,
    fetcher,
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  return {
    hostels: data ?? [],
    data: data ?? [],
    isLoading,
    isError: Boolean(error),
    error,
    mutate: mutate as KeyedMutator<HostelItem[]>,
  };
}
