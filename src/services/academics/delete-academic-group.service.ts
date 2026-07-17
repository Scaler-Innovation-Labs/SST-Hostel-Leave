import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroupRepository } from "@/db/repositories/academics/academic-group.repository";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteAcademicGroup(id: string, currentUser: { id: string }): Promise<void> {
  return transaction(async (tx) => {
    const existing = await academicGroupRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Academic group not found");
    }

    await academicGroupRepository.deleteById(id, tx);

    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.ACADEMIC_GROUP,
      id,
      currentUser.id,
      {},
      tx
    );
  });
}
