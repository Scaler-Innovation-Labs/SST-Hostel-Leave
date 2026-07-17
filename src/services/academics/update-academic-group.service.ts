import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroupRepository, type AcademicGroupRow } from "@/db/repositories/academics/academic-group.repository";
import type { SaveAcademicGroupInput } from "@/dto/academic-group/save-academic-group.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateAcademicGroup(id: string, input: SaveAcademicGroupInput, currentUser: { id: string }): Promise<AcademicGroupRow> {
  return transaction(async (tx) => {
    const existing = await academicGroupRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Academic group not found");
    }

    const row = await academicGroupRepository.updateById(id, input, tx);

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.ACADEMIC_GROUP,
      id,
      currentUser.id,
      { departmentId: input.departmentId, batchYear: input.batchYear, groupCode: input.groupCode ?? null },
      tx
    );

    return row!;
  });
}
