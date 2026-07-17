const BASE = "/api/v1/academic-groups";

export async function saveAcademicGroup(data: Record<string, unknown>, id?: string): Promise<unknown> {
  const response = await fetch(id ? `${BASE}/${id}` : BASE, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to save academic group");
  }
  return result.data;
}

export async function deleteAcademicGroup(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to delete academic group");
  }
}
