const BASE = "/api/v1";

export type ListWorkflowsParams = {
  search?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export function getWorkflowsUrl(params?: ListWorkflowsParams): string {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.isActive) searchParams.set("isActive", params.isActive);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return `${BASE}/workflows${qs ? `?${qs}` : ""}`;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`${BASE}/workflows/${id}`, {
    method: "DELETE",
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to delete workflow");
  }
}

export async function saveWorkflow(
  data: Record<string, unknown>,
  id?: string,
): Promise<unknown> {
  const response = await fetch(id ? `${BASE}/workflows/${id}` : `${BASE}/workflows`, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to save workflow");
  }
  return result.data;
}
