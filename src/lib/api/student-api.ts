import type { ListStudentsQuery } from "@/dto/student/list-students.dto";
import { buildQueryString } from "@/lib/api/query-string";

const BASE = "/api/v1";

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
