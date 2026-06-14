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
  page?: number;
  limit?: number;
}): string {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
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
  data: { decision: string; comments?: string }
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
