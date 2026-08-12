"use client";

import useSWR from "swr";

import { getQrPassesUrl } from "@/lib/api/movement-api";

export type QrPass = {
  id: string;
  status: string;
  qrType: string;
  /** The single stable pass token — served so the student can re-display the same QR. */
  token: string | null;
  expiresAt: string | null;
  generatedAt: string | null;
  firstScanAt: string | null;
  closedAt: string | null;
  invalidatedAt: string | null;
  createdAt: string | null;
};

export function useQrPasses(leaveId: string | undefined) {
  // Fetches once on mount — call `mutate()` after generate/regenerate/cancel
  // instead of polling, so the page stays quiet while viewing.
  const { data, error, isLoading, mutate } = useSWR(
    leaveId ? getQrPassesUrl(leaveId) : null,
  );

  return {
    qrPasses: (data?.data ?? []) as QrPass[],
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
