import { type Parent, parentRepository } from "@/db/repositories/parent/parent.repository";
import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

export type StudentWithParents = StudentWithRelations & {
  parents: Parent[];
};

export async function getStudent(
  id: string,
  currentUser: CurrentUser
): Promise<StudentWithParents> {
  // Detail-read guard: scoped staff may only view students in their own
  // hostels; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(currentUser, id);

  const result = await studentRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("Student");
  }

  const parents = await parentRepository.findByStudentId(id);

  return {
    ...result,
    parents,
  };
}

