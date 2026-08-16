import useSWR from "swr";

import { getExtensionsUrl } from "@/lib/api/extension-api";
import { fetcher } from "@/lib/api/fetcher";

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
