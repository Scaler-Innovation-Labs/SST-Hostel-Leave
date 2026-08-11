import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import type { ListStudentsQuery } from "@/dto/student/list-students.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function listStudents(query: ListStudentsQuery, currentUser?: CurrentUser): Promise<{
  items: StudentWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const hostelIds =
    currentUser && isStaffScopeRestricted(currentUser)
      ? getScopedHostelIds(currentUser)
      : undefined;

  return studentRepository.findByFilters({
    locationState: query.locationState,
    search: query.search,
    hostelIds,
    page: query.page,
    limit: query.limit,
  });
}

