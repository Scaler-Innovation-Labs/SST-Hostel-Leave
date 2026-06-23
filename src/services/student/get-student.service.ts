import { studentRepository } from "@/db/repositories/student/student.repository";
import { NotFoundError } from "@/lib/errors";

export async function getStudent(id: string) {
  const result = await studentRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("Student");
  }

  return result;
}

