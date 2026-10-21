import useSWR from "swr";

import type { ApprovalOverrideType } from "@/constants/leave/approval-override-type";
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
      approverParentId?: string | null;
      approverName?: string | null;
      approverPhone?: string | null;
      approvalSource?: string | null;
      overrideType?: ApprovalOverrideType | null;
      decision: string;
      comments: string | null;
      actedAt?: string | null;
      createdAt: string;
      stepOrder: number;
      stepKey: string;
    }>) ?? [],
    total: data?.data?.total ?? 0,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
