"use client";

import useSWR from "swr";

import type { ListMovementsQuery } from "@/dto/movement/list-movements.dto";
import { getMovementsUrl } from "@/lib/api/movement-api";

export function useMovement(query?: Partial<ListMovementsQuery>) {
  const { data, error, isLoading, mutate } = useSWR(
    query ? getMovementsUrl(query) : null,
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
