import useSWR from "swr";

import { getExtensionsUrl } from "@/lib/api/extension-api";
import { fetcher } from "@/lib/api/fetcher";

export type LeaveExtensionItem = {
  id: string;
  leaveRequestId: string;
  extensionNumber: number;
  status: string;
  reason: string;
  currentEndAt: string;
  requestedEndAt: string;
  currentStepKey?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
};

export function useLeaveExtensions(leaveId: string) {
  const url = leaveId ? getExtensionsUrl(leaveId) : null;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    data: data as {
      items: LeaveExtensionItem[] | null;
      total: number;
    } | undefined,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
