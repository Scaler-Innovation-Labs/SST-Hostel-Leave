import useSWR from "swr";

import { getApprovalsUrl } from "@/lib/api/approval-api";

export function useApprovalChain(leaveRequestId: string) {
  const url = leaveRequestId ? getApprovalsUrl({ leaveRequestId, page: 1, limit: 100 }) : null;

  const { data, error, isLoading, mutate } = useSWR(url);

  return {
    approvals: (data?.data?.items as Array<{
      id: string;
      leaveRequestId: string;
      approverUserId: string | null;
      approverRoleId: string;
      approverRoleCode: string | null;
      decision: string;
      comments: string | null;
      createdAt: string;
      stepOrder: number;
      stepKey: string;
      approverName?: string;
    }>) ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
