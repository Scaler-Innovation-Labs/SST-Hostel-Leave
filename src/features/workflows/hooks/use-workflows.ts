import useSWR from "swr";

import { getWorkflowsUrl } from "@/lib/api/workflow-api";

const fetcher = (url: string) => fetch(url).then((r) => r.json()).then((r) => r.data ?? r);

export function useWorkflows(params?: {
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
}) {
  const url = getWorkflowsUrl(params);

  const { data, error, isLoading, mutate } = useSWR(url, fetcher);

  return {
    data: data as {
      items: Array<{
        id: string;
        name: string;
        code: string;
        description: string | null;
        isActive: boolean;
        version: number;
        createdAt: string;
        steps: Array<{
          id: string;
          stepKey: string;
          stepOrder: number;
          stepName: string;
          approverRoleName: string | null;
          approverRoleCode: string | null;
          isParentApproval: boolean;
          approvalMethod: string | null;
          isRequired: boolean;
        }>;
      }>;
      total: number;
      page: number;
      totalPages: number;
    },
    isLoading,
    isError: !!error,
    error,
    mutate,
  };
}
