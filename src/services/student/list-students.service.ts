import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import type { ListStudentsQuery } from "@/dto/student/list-students.dto";

export async function listStudents(query: ListStudentsQuery): Promise<{
  items: StudentWithRelations[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  return studentRepository.findByFilters({
    locationState: query.locationState,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

