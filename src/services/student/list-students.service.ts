import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ListStudentsQuery } from "@/dto/student/list-students.dto";

export async function listStudents(query: ListStudentsQuery) {
  return studentRepository.findByFilters({
    locationState: query.locationState,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });
}

