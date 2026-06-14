"use client";

import useSWR from "swr";

import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { getLeavesUrl,getLeaveUrl } from "@/lib/api/leave-api";

type RawLeaveItem = {
  leave: {
    id: string;
    status: string;
    startAt: string;
    endAt: string;
    expectedReturnAt?: string;
    reason: string;
    createdAt: string;
    requestNumber: string;
    isActive: boolean;
  };
  leaveType: { name: string } | null;
  student: { rollNumber: string } | null;
  user: { fullName: string; email?: string; phone?: string } | null;
};

function flattenLeaveItem(item: RawLeaveItem) {
  return {
    id: item.leave.id,
    status: item.leave.status,
    startAt: item.leave.startAt,
    endAt: item.leave.endAt,
    expectedReturnAt: item.leave.expectedReturnAt,
    reason: item.leave.reason,
    createdAt: item.leave.createdAt,
    requestNumber: item.leave.requestNumber,
    isActive: item.leave.isActive,
    leaveTypeName: item.leaveType?.name,
    studentFirstName: item.user?.fullName?.split(" ")[0],
    studentLastName: item.user?.fullName?.split(" ").slice(1).join(" "),
    _raw: item,
  };
}

export type FlatLeave = ReturnType<typeof flattenLeaveItem>;

export function useLeaves(query?: Partial<ListLeavesQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getLeavesUrl(query) : null,
  );

  const rawItems: RawLeaveItem[] = data?.data?.items ?? [];

  return {
    leaves: rawItems.map(flattenLeaveItem),
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

// export function useLeave(id: string | undefined) {
//   const { data, error, isLoading, mutate } = useSWR(
//     id ? getLeaveUrl(id) : null,
//   );

//   return {
//     leave: data?.data ?? null,
//     isLoading,
//     isError: !!error,
//     error,
//     mutate,
//   };
// }
export function useLeave(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? getLeaveUrl(id) : null,
  );

  const raw = data?.data as {
    leave: {
      id: string;
      status: string;
      startAt: string;
      endAt: string;
      expectedReturnAt?: string;
      reason: string;
      createdAt: string;
      requestNumber: string;
      isActive: boolean;
    };
    leaveType: { name: string } | null;
    student: { rollNumber: string } | null;
    user: { fullName: string; email?: string; phone?: string } | null;
  } | undefined;

  const leave = raw
    ? {
        id: raw.leave.id,
        status: raw.leave.status,
        startAt: raw.leave.startAt,
        endAt: raw.leave.endAt,
        expectedReturnAt: raw.leave.expectedReturnAt,
        reason: raw.leave.reason,
        createdAt: raw.leave.createdAt,
        requestNumber: raw.leave.requestNumber,
        isActive: raw.leave.isActive,
        leaveTypeName: raw.leaveType?.name,
        studentFirstName: raw.user?.fullName?.split(" ")[0],
        studentLastName: raw.user?.fullName?.split(" ").slice(1).join(" "),
        // Nested raw data for detail views that need the full structure
        _raw: raw,
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

export function useLeaveTypes() {
  const { data, error, isLoading } = useSWR("/api/v1/leave-types");

  return {
    leaveTypes: data?.data ?? [],
    isLoading,
    isError: !!error,
    error,
  };
}
