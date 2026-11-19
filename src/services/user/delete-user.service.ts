import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { db } from "@/lib/db";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteUser(
  id: string,
  actorUserId: string
): Promise<{ id: string }> {
  const user = await userRepository.findById(id, db);
  if (!user) {
    throw new NotFoundError("User");
  }

  if (id === actorUserId) {
    throw new ValidationError("You cannot delete your own account");
  }

  const student = await studentRepository.findByUserId(id, db);
  if (student) {
    throw new ValidationError("Cannot delete a user linked to a student record. Delete the student profile first.");
  }

  // Atomic transaction: if deleting the user fails on a foreign-key constraint,
  // role removal rolls back so we never leave a live user with all roles wiped.
  await transaction(async (tx) => {
    await userRoleRepository.deleteByUserId(id, tx);
    await userRepository.deleteById(id, tx);
    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.USER,
      id,
      actorUserId,
      { email: user.email, fullName: user.fullName },
      tx
    );
  });

  return { id };
}
