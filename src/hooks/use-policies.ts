"use client";

import useSWR from "swr";

export function usePolicies() {
  const { data, error, isLoading, mutate } = useSWR("/api/v1/policies");
  return { policies: data?.data ?? [], isLoading, isError: Boolean(error), error, mutate };
}
