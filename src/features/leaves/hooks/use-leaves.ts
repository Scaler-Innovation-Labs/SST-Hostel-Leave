"use client";

import useSWR from "swr";

import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { getLeavesUrl,getLeaveUrl } from "@/lib/api/leave-api";

export type RawLeaveItem = {
  leave: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    reason: string;
    createdAt: string;
    requestNumber: string;
    submittedAt?: string | null;
    submittedForm?: Record<string, unknown> | null;
    currentStepKey?: string | null;
    currentStepOrder?: number | null;
    policyResult?: Record<string, unknown> | null;
  };
  leaveType: { name: string; uiConfig?: Record<string, unknown> | null } | null;
  student: { rollNumber: string } | null;
  user: { fullName: string; email?: string; phone?: string } | null;
};

function flattenLeaveItem(item: RawLeaveItem) {
  return {
    id: item.leave.id,
    status: item.leave.status,
    startAt: item.leave.startAt,
    endAt: item.leave.endAt,
    reason: item.leave.reason,
    createdAt: item.leave.createdAt,
    requestNumber: item.leave.requestNumber,
    submittedAt: item.leave.submittedAt ?? item.leave.createdAt,
    submittedForm: (item.leave.submittedForm as Record<string, unknown> | null) ?? null,
    currentStepKey: item.leave.currentStepKey ?? null,
    currentStepOrder: item.leave.currentStepOrder ?? null,
    destination: (item.leave.submittedForm as Record<string, unknown> | null)?.destination as string | undefined,
    leaveTypeName: item.leaveType?.name,
    leaveTypeUiConfig:
      (item.leaveType?.uiConfig as Record<string, unknown> | null | undefined) ?? null,
    studentFirstName: item.user?.fullName?.split(" ")[0],
    studentLastName: item.user?.fullName?.split(" ").slice(1).join(" "),
    userFullName: item.user?.fullName ?? null,
    userEmail: item.user?.email ?? null,
    userPhone: item.user?.phone ?? null,
    studentRollNumber: item.student?.rollNumber ?? null,
    policyResult: item.leave.policyResult as { checks?: Array<{ key: string; label: string; passed: boolean; message?: string }>; restrictions?: string[] } | null,
  };
}

export type FlatLeave = ReturnType<typeof flattenLeaveItem>;

export function useLeaves(query?: Partial<ListLeavesQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getLeavesUrl(query) : null,
    { refreshInterval: 15000 },
  );

  const rawItems: RawLeaveItem[] = data?.data?.items ?? [];

  return {
    leaves: rawItems.map(flattenLeaveItem),
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    totalPages: data?.data?.totalPages ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useLeave(id: string | undefined) {
  // Fetches once on mount — the page's Refresh button and the `mutate()`
  // calls after cancel/extension keep it fresh without background polling.
  const { data, error, isLoading, mutate } = useSWR(
    id ? getLeaveUrl(id) : null,
  );

  const raw = data?.data as RawLeaveItem | undefined;

  const leave = raw
    ? {
        ...flattenLeaveItem(raw),
      }
    : null;

  return {
    leave,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export type LeaveTypeOption = {
  id: string;
  code: string;
  name: string;
  category: string;
  description?: string | null;
  isActive: boolean;
  requiresPoc?: boolean;
  formSchema?: { fields: Array<Record<string, unknown>> };
};

export function useLeaveTypes() {
  const { data, error, isLoading } = useSWR<{ data: LeaveTypeOption[] }>("/api/v1/leave-types");

  return {
    leaveTypes: data?.data ?? ([] as LeaveTypeOption[]),
    isLoading,
    isError: !!error,
    error,
  };
}
