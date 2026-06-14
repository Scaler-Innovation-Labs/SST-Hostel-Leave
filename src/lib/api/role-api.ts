const BASE = "/api/v1";

export function getRolesUrl(): string {
  return `${BASE}/roles`;
}

export async function fetchRoles(): Promise<Array<{ id: string; code: string; name: string }>> {
  const res = await fetch(getRolesUrl());
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? "Failed to fetch roles");
  }
  return json.data;
}
