"use client";

import useSWR from "swr";

import { getQrPassesUrl } from "@/lib/api/movement-api";

export type QrPass = {
  id: string;
  status: string;
  qrType: string;
  expiresAt: string | null;
  generatedAt: string | null;
  firstScanAt: string | null;
  closedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string | null;
};

export function useQrPasses(
  leaveId: string | undefined,
  options?: { dedupingInterval?: number; revalidateOnFocus?: boolean }
) {
  // Revalidates on focus so pass status transitions (used/closed/expired)
  // are detected immediately when the user returns to the screen.
  const { data, error, isLoading, mutate } = useSWR(
    leaveId ? getQrPassesUrl(leaveId) : null,
    {
      dedupingInterval: options?.dedupingInterval ?? 30_000,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    }
  );

  return {
    qrPasses: (data?.data ?? []) as QrPass[],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
