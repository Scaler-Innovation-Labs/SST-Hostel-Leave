import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroupRepository, type AcademicGroupRow } from "@/db/repositories/academics/academic-group.repository";
import type { SaveAcademicGroupInput } from "@/dto/academic-group/save-academic-group.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createAcademicGroup(input: SaveAcademicGroupInput, currentUser: { id: string }): Promise<AcademicGroupRow> {
  return transaction(async (tx) => {
    const existing = await academicGroupRepository.findByUnique(input.departmentId, input.batchYear, input.groupCode, tx);
    if (existing) {
      throw new ConflictError("Academic group with same department, batch year, and group code already exists");
    }

    const row = await academicGroupRepository.create(input, tx);

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.ACADEMIC_GROUP,
      row.id,
      currentUser.id,
      { departmentId: input.departmentId, batchYear: input.batchYear, groupCode: input.groupCode ?? null },
      tx
    );

    return row;
  });
}
