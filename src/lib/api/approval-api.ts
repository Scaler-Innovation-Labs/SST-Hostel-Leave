import type { ListApprovalsQuery } from "@/dto/approval/list-approvals.dto";
import type { ApiResponse } from "@/types/api";
import { buildQueryString } from "@/lib/api/query-string";

const BASE = "/api/v1";

export function getApprovalsUrl(query?: Partial<ListApprovalsQuery>): string {
  const qs = buildQueryString({
    status: query?.status,
    leaveRequestId: query?.leaveRequestId,
    dateFrom: query?.dateFrom,
    dateTo: query?.dateTo,
    search: query?.search,
    page: query?.page,
    limit: query?.limit,
  });
  return `${BASE}/approvals${qs ? `?${qs}` : ""}`;
}

export async function approveLeave(
  id: string,
  comments?: string
): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "APPROVED", comments }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to approve leave");
  }
  return json.data;
}

export async function rejectLeave(
  id: string,
  comments?: string
): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision: "REJECTED", comments }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to reject leave");
  }
  return json.data;
}
