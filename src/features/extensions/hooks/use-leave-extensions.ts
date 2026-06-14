import useSWR from "swr";

import { getExtensionsUrl } from "@/lib/api/extension-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

export function useLeaveExtensions(leaveId: string) {
  const url = leaveId ? getExtensionsUrl(leaveId) : null;

  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    data: data as {
      items: Array<{
        id: string;
        extensionNumber: number;
        status: string;
        reason: string;
        requestedEndAt: string;
        createdAt: string;
      }> | null;
      total: number;
    },
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
