import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteStudent(
  id: string,
  actorUserId: string | null = null,
): Promise<{ deleted: boolean }> {
  return transaction(async (tx) => {
    const existing = await studentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Student");
    }

    const userId = existing.userId;

    await studentRepository.deleteById(id, tx);
    await userRepository.deleteById(userId, tx);

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.DELETE,
        AUDIT_ENTITY_TYPE.STUDENT,
        id,
        actorUserId,
        { rollNumber: existing.rollNumber, userId },
        tx,
      );
    }

    return { deleted: true };
  });
}
