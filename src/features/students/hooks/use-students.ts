"use client";

import useSWR from "swr";

import type { ListStudentsQuery } from "@/dto/student/list-students.dto";
import { getStudentsUrl,getStudentUrl } from "@/lib/api/student-api";

export function useStudents(query?: Partial<ListStudentsQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getStudentsUrl(query) : null,
  );

  return {
    students: data?.data?.items ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useStudent(id: string | undefined) {
  const { data, error, isLoading, mutate } = useSWR(
    id ? getStudentUrl(id) : null,
  );

  return {
    student: data?.data ?? null,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
