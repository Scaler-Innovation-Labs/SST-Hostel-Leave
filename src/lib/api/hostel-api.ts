const BASE = "/api/v1/hostels";

export function getHostelsUrl(): string {
  return BASE;
}

export async function fetchHostels(): Promise<Array<{ id: string; name: string; code: string }>> {
  const res = await fetch(getHostelsUrl());
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch hostels");
  }
  return json.data;
}

export async function saveHostel(data: Record<string, unknown>, id?: string): Promise<unknown> {
  const response = await fetch(id ? `${BASE}/${id}` : BASE, {
    method: id ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to save hostel");
  }
  return result.data;
}

export async function deleteHostel(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error?.message ?? "Failed to delete hostel");
  }
}
