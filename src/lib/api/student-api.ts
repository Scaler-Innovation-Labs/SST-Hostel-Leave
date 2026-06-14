import type { ListStudentsQuery } from "@/dto/student/list-students.dto";

const BASE = "/api/v1";

function buildQueryString(params: Record<string, string | number | undefined>): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      searchParams.set(key, String(value));
    }
  }
  return searchParams.toString();
}

export function getStudentsUrl(query?: Partial<ListStudentsQuery>): string {
  const qs = buildQueryString({
    locationState: query?.locationState,
    search: query?.search,
    page: query?.page,
    limit: query?.limit,
  });
  return `${BASE}/students${qs ? `?${qs}` : ""}`;
}

export function getStudentUrl(id: string): string {
  return `${BASE}/students/${id}`;
}
