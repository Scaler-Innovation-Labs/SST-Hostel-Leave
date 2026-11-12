import type { CreateExtensionDto } from "@/dto/leave/create-extension.dto";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1";

export function getExtensionsUrl(leaveId: string, params?: { page?: number; limit?: number }): string {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return `${BASE}/leaves/${leaveId}/extensions${qs ? `?${qs}` : ""}`;
}

export function getExtensionUrl(id: string): string {
  return `${BASE}/extensions/${id}`;
}

export function getExtensionApprovalsUrl(params?: {
  status?: string;
  search?: string;
  waitingOn?: string;
  leaveRequestId?: string;
  leaveExtensionId?: string;
  hostelId?: string;
  leaveTypeId?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}): string {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.waitingOn) searchParams.set("waitingOn", params.waitingOn);
  if (params?.leaveRequestId) searchParams.set("leaveRequestId", params.leaveRequestId);
  if (params?.leaveExtensionId) searchParams.set("leaveExtensionId", params.leaveExtensionId);
  if (params?.hostelId) searchParams.set("hostelId", params.hostelId);
  if (params?.leaveTypeId) searchParams.set("leaveTypeId", params.leaveTypeId);
  if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
  if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return `${BASE}/extensions/approvals${qs ? `?${qs}` : ""}`;
}

export async function createExtension(leaveId: string, data: CreateExtensionDto): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${leaveId}/extensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to create extension");
  }
  return json.data;
}

export async function approveExtension(
  id: string,
  data: { decision: string; comments?: string; forceOverride?: boolean }
): Promise<unknown> {
  const res = await fetch(`${BASE}/extensions/${id}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to approve extension");
  }
  return json.data;
}

export async function overrideExtension(
  id: string,
  modeOrOptions: "ONE_STEP" | "ALL" | { mode: "ONE_STEP" | "ALL"; comments?: string },
  commentsArg?: string
): Promise<unknown> {
  const mode = typeof modeOrOptions === "string" ? modeOrOptions : modeOrOptions.mode;
  const comments = typeof modeOrOptions === "string" ? commentsArg : modeOrOptions.comments;
  const res = await fetch(`${BASE}/extensions/${id}/override`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, comments }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to override extension");
  }
  return json.data;
}

export async function resendExtensionParentApproval(
  id: string
): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/extensions/${id}/resend-parent-approval`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  const json: ApiResponse<{ success: boolean; message: string }> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to resend parent approval link");
  }
  return json.data ?? { success: true, message: "Parent approval link resent successfully" };
}
