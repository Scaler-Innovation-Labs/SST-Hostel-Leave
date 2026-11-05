"use client";

import useSWR, { type KeyedMutator } from "swr";

import { fetcher } from "@/lib/api/fetcher";

export type AcademicGroupItem = {
  id: string;
  departmentId: string;
  batchYear: number;
  name: string;
  groupCode: string | null;
  code?: string | null;
  isActive: boolean;
};

export const ACADEMIC_GROUPS_SWR_KEY = "/api/v1/academic-groups";

export function useAcademicGroups() {
  const { data, error, isLoading, mutate } = useSWR<AcademicGroupItem[]>(
    ACADEMIC_GROUPS_SWR_KEY,
    fetcher,
    {
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30_000,
    }
  );

  return {
    academicGroups: data ?? [],
    data: data ?? [],
    isLoading,
    isError: Boolean(error),
    error,
    mutate: mutate as KeyedMutator<AcademicGroupItem[]>,
  };
}
