import { type Student,studentRepository } from "@/db/repositories/student/student.repository";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError } from "@/lib/errors";

export async function verifyStudentOwnership(
  currentUser: CurrentUser,
  resourceStudentId: string,
): Promise<void> {
  if (currentUser.roles.some(r => r === ROLES.ADMIN || r === ROLES.POC || r === ROLES.SUPER_ADMIN)) {
    return;
  }

  const student = await studentRepository.findByUserId(currentUser.id);
  if (!student || student.id !== resourceStudentId) {
    throw new AuthorizationError("You do not have access to this resource");
  }
}

export async function requireCurrentUserStudent(currentUser: CurrentUser): Promise<Student> {
  if (currentUser.roles.some(r => r === ROLES.ADMIN || r === ROLES.POC || r === ROLES.SUPER_ADMIN)) {
    throw new AuthorizationError("Only students can perform this action");
  }

  const student = await studentRepository.findByUserId(currentUser.id);
  if (!student) {
    throw new AuthorizationError("Student profile not found");
  }

  return student;
}
