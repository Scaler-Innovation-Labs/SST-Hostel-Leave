"use client";

import useSWR from "swr";

import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";
import { getMovementsUrl } from "@/lib/api/movement-api";

export type UseMovementOptions = {
  refreshInterval?: number;
  dedupingInterval?: number;
  revalidateOnFocus?: boolean;
};

export function useMovement(
  query?: Partial<ListMovementsQuery>,
  options?: UseMovementOptions
) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getMovementsUrl(query) : null,
    {
      refreshInterval: options?.refreshInterval ?? 0,
      dedupingInterval: options?.dedupingInterval ?? 30_000,
      revalidateOnFocus: options?.revalidateOnFocus ?? true,
    }
  );

  return {
    movements: data?.data?.items ?? [],
    total: data?.data?.total ?? 0,
    page: data?.data?.page ?? 1,
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
