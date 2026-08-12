import useSWR, { mutate as globalMutate } from "swr";

import type { ApprovalQueueItem } from "@/features/approvals/hooks/use-approvals";
import { getExtensionApprovalsUrl } from "@/lib/api/extension-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

type UseExtensionApprovalsOptions = {
  status?: string;
  search?: string;
  waitingOn?: string;
  hostelId?: string;
  leaveTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

export function useExtensionApprovals(options?: UseExtensionApprovalsOptions) {
  const url = getExtensionApprovalsUrl(options);

  const { data, error, isLoading, mutate } = useSWR(url, fetcher, { refreshInterval: 30_000 });

  return {
    data: data as {
      items: ApprovalQueueItem[];
      total: number;
      page: number;
      totalPages: number;
      stats?: { total: number; pending: number; approved: number; rejected: number };
    },
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}

export function useApproveExtension() {
  const handleApprove = async (
    id: string,
    data: { decision: string; comments?: string }
  ) => {
    const res = await fetch(`/api/v1/extensions/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error?.message ?? "Failed to approve extension");
    }
    await globalMutate((key: string) => typeof key === "string" && key.includes("/extensions/approvals"));
    return json.data;
  };

  return { approveExtension: handleApprove };
}
