import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroups } from "@/db/schema/academics";
import type { SaveAcademicGroupInput } from "@/dto/academic-group/save-academic-group.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateAcademicGroup(id: string, input: SaveAcademicGroupInput, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(academicGroups).where(eq(academicGroups.id, id)).limit(1);
    if (existing.length === 0) {
      throw new NotFoundError("Academic group not found");
    }

    const [row] = await tx.update(academicGroups).set(input).where(eq(academicGroups.id, id)).returning();

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.ACADEMIC_GROUP,
      id,
      currentUser.id,
      { departmentId: input.departmentId, batchYear: input.batchYear, groupCode: input.groupCode ?? null },
      tx
    );

    return row;
  });
}
