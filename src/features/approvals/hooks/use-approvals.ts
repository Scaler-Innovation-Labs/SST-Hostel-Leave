"use client";

import useSWR from "swr";

import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import { getApprovalsUrl } from "@/lib/api/approval-api";

export type ApprovalQueueItem = {
  id: string;
  studentName: string | null;
  studentRollNumber: string | null;
  decision: string;
  approverRoleCode: string | null;
  createdAt: Date | string;
  stepKey: string | null;
  stepOrder: number | null;
  parentApprovalVerifiedAt: Date | string | null;
  approverParentId: string | null;
  parentName: string | null;
  parentPhone: string | null;
  leaveExtensionId: string | null;
  roomNumber: string | null;
  hostelName: string | null;
  departmentName: string | null;
  leaveTypeName: string | null;
  leaveRequest: {
    id: string;
    status: string;
    startAt: Date | string;
    endAt: Date | string;
    reason: string;
    requestNumber: string;
    createdAt?: Date | string;
    submittedForm?: Record<string, unknown> | null;
    currentStepKey?: string | null;
    currentStepOrder?: number | null;
    policyResult?: Record<string, unknown> | null;
  } | null;
};

export function useApprovals(query?: Partial<ListApprovalsQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getApprovalsUrl(query) : null,
    { refreshInterval: 15_000 },
  );

  return {
    approvals: (data?.data?.items ?? []) as ApprovalQueueItem[],
    total: data?.data?.total ?? 0,
    totalPages: data?.data?.totalPages ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
