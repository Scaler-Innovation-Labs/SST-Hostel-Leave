import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { buildQueryString } from "@/lib/api/query-string";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1";

export function getLeavesUrl(query?: Partial<ListLeavesQuery>): string {
  const qs = buildQueryString({
    studentId: query?.studentId,
    status: query?.status,
    leaveTypeId: query?.leaveTypeId,
    startDate: query?.startDate,
    endDate: query?.endDate,
    search: query?.search,
    page: query?.page,
    limit: query?.limit,
  });
  return `${BASE}/leaves${qs ? `?${qs}` : ""}`;
}

export function getLeaveUrl(id: string): string {
  return `${BASE}/leaves/${id}`;
}

export function getLeaveTypesUrl(): string {
  return `${BASE}/leave-types`;
}

export async function createLeave(data: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to create leave");
  }
  return json.data;
}

export async function cancelLeave(id: string): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${id}/cancel`, { method: "POST" });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to cancel leave");
  }
  return json.data;
}

export function getDocumentsUrl(leaveId: string): string {
  return `${BASE}/leaves/${leaveId}/documents`;
}

export function getDocumentUrl(leaveId: string, documentId: string): string {
  return `${BASE}/leaves/${leaveId}/documents/${documentId}`;
}

export async function uploadLeaveDocument(
  leaveId: string,
  file: File,
  documentType: string,
): Promise<unknown> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const res = await fetch(getDocumentsUrl(leaveId), {
    method: "POST",
    body: formData,
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to upload document");
  }
  return json.data;
}

export async function deleteLeaveDocument(
  leaveId: string,
  documentId: string,
): Promise<unknown> {
  const res = await fetch(getDocumentUrl(leaveId, documentId), {
    method: "DELETE",
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to delete document");
  }
  return json.data;
}
