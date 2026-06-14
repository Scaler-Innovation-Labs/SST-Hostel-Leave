const BASE = "/api/v1";

export function getHostelsUrl(): string {
  return `${BASE}/hostels`;
}

export async function fetchHostels(): Promise<Array<{ id: string; name: string; code: string }>> {
  const res = await fetch(getHostelsUrl());
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch hostels");
  }
  return json.data;
}
