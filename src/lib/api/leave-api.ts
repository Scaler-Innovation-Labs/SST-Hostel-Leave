import { mutate as globalMutate } from "swr";

import type { ListLeavesQuery } from "@/dto/leave/list-leaves.dto";
import { buildQueryString } from "@/lib/api/query-string";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1";

export function getLeavesUrl(query?: Partial<ListLeavesQuery>): string {
  const qs = buildQueryString({
    studentId: query?.studentId,
    status: query?.status,
    leaveTypeId: query?.leaveTypeId,
    hostelId: query?.hostelId,
    startDate: query?.startDate,
    endDate: query?.endDate,
    search: query?.search,
    sortBy: query?.sortBy,
    sortOrder: query?.sortOrder,
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
  void globalMutate(
    (key) => typeof key === "string" && (key.startsWith("/api/v1/leaves") || key.startsWith("/api/v1/dashboard/stats")),
    undefined,
    { revalidate: true }
  );
  return json.data;
}

export async function cancelLeave(id: string): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${id}/cancel`, { method: "POST" });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to cancel leave");
  }
  void globalMutate(
    (key) => typeof key === "string" && (key.startsWith("/api/v1/leaves") || key.startsWith("/api/v1/dashboard/stats")),
    undefined,
    { revalidate: true }
  );
  return json.data;
}

export async function resendParentApproval(id: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch(`${BASE}/leaves/${id}/resend-parent-approval`, { method: "POST" });
  const json: ApiResponse<{ success: boolean; message: string }> = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to resend parent approval SMS");
  }
  return json.data as { success: boolean; message: string };
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

// ─── Questions ────────────────────────────────────────────────

export function getQuestionsUrl(leaveId: string, params?: { page?: number; limit?: number }): string {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return `${BASE}/leaves/${leaveId}/questions${qs ? `?${qs}` : ""}`;
}

export async function askLeaveQuestion(
  leaveId: string,
  question: string,
): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${leaveId}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to submit question");
  }
  return json.data;
}

export async function answerLeaveQuestion(
  leaveId: string,
  questionId: string,
  answer: string,
): Promise<unknown> {
  const res = await fetch(`${BASE}/leaves/${leaveId}/questions/${questionId}/answer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answer }),
  });
  const json: ApiResponse = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to answer question");
  }
  return json.data;
}
