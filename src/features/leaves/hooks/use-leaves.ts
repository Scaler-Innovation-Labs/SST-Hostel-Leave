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
    userFullName: item.user?.fullName ?? null,
    userEmail: item.user?.email ?? null,
    userPhone: item.user?.phone ?? null,
    studentRollNumber: item.student?.rollNumber ?? null,
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

export function useLeaveTypes() {
  const { data, error, isLoading } = useSWR("/api/v1/leave-types");

  return {
    leaveTypes: data?.data ?? [],
    isLoading,
    isError: !!error,
    error,
  };
}
