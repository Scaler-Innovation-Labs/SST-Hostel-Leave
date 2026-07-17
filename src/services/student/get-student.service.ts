import { studentRepository, type StudentWithRelations } from "@/db/repositories/student/student.repository";
import { NotFoundError } from "@/lib/errors";

export async function getStudent(id: string): Promise<StudentWithRelations> {
  const result = await studentRepository.findByIdWithRelations(id);

  if (!result) {
    throw new NotFoundError("Student");
  }

  return result;
}

