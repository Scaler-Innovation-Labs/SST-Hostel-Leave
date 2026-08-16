import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import type { CurrentUser } from "@/lib/auth/types";
import { NotFoundError } from "@/lib/errors";
import { assertCanAccessStudent } from "@/services/shared/authorization.service";

export async function getStudent(
  id: string,
  currentUser: CurrentUser
): Promise<StudentWithRelations> {
  // Detail-read guard: scoped staff may only view students in their own
  // hostels; SUPER_ADMIN is unrestricted.
  await assertCanAccessStudent(currentUser, id);

  const result = await studentRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("Student");
  }

  return result;
}

