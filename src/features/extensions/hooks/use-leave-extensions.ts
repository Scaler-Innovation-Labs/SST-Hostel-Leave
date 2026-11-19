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
  currentStepOrder?: number | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  createdAt: string;
  approvals?: Array<{
    id: string;
    stepKey: string;
    stepOrder: number;
    decision: string;
    approvalSource?: string | null;
    comments?: string | null;
    actedAt?: string | null;
    createdAt: string;
    rejectionCategory?: string | null;
  }>;
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
