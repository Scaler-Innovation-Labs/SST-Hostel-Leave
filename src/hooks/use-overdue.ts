"use client";

import useSWR, { type KeyedMutator } from "swr";

export const OVERDUE_SWR_KEY = "/api/v1/overdue";
export const OVERDUE_POLL_INTERVAL = 180_000; // 3 minutes

export type OverdueReturn = {
  id: string;
  studentId: string;
  firstScanAt: string | null;
  status: string;
  studentName: string | null;
  studentRollNumber: string | null;
  roomNumber: string | null;
  hostelId: string | null;
  hostelName: string | null;
  leaveTypeName: string | null;
  requestNumber: string | null;
  leaveStartAt: string | null;
  leaveEndAt: string | null;
};

const overdueFetcher = async (url: string): Promise<OverdueReturn[]> => {
  const res = await fetch(url);
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: "Request failed" }));
    throw new Error(error?.message || `HTTP ${res.status}`);
  }
  const r = await res.json();
  return Array.isArray(r?.data) ? r.data : [];
};

export type UseOverdueOptions = {
  refreshInterval?: number;
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
};

export function useOverdue(options?: UseOverdueOptions): {
  data: OverdueReturn[] | undefined;
  overdue: OverdueReturn[];
  isLoading: boolean;
  isError: boolean;
  error: Error | undefined;
  mutate: KeyedMutator<OverdueReturn[]>;
} {
  const { data, error, isLoading, mutate } = useSWR<OverdueReturn[]>(
    OVERDUE_SWR_KEY,
    overdueFetcher,
    {
      refreshInterval: options?.refreshInterval ?? OVERDUE_POLL_INTERVAL,
      dedupingInterval: options?.dedupingInterval ?? 30_000,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    }
  );

  return {
    data,
    overdue: data ?? [],
    isLoading,
    isError: Boolean(error),
    error: error as Error | undefined,
    mutate,
  };
}
