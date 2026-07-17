const BASE = "/api/v1";

export type ListUsersParams = {
  search?: string;
  role?: string;
  excludeRole?: string;
  isActive?: string;
  page?: number;
  limit?: number;
};

export function getUsersUrl(params?: ListUsersParams): string {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.role) searchParams.set("role", params.role);
  if (params?.excludeRole) searchParams.set("excludeRole", params.excludeRole);
  if (params?.isActive) searchParams.set("isActive", params.isActive);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return `${BASE}/users${qs ? `?${qs}` : ""}`;
}

export function getUserUrl(id: string): string {
  return `${BASE}/users/${id}`;
}
