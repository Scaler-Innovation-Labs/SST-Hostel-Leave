const BASE = "/api/v1/policies";

export async function savePolicy(data: Record<string, unknown>, id?: string): Promise<unknown> {
  const response = await fetch(id ? `${BASE}/${id}` : BASE, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error?.message ?? "Failed to save policy");
  return result.data;
}
