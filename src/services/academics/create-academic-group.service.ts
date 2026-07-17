import { and, eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroups } from "@/db/schema/academics";
import type { SaveAcademicGroupInput } from "@/dto/academic-group/save-academic-group.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createAcademicGroup(input: SaveAcademicGroupInput, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(academicGroups)
      .where(
        and(
          eq(academicGroups.departmentId, input.departmentId),
          eq(academicGroups.batchYear, input.batchYear),
          input.groupCode ? eq(academicGroups.groupCode, input.groupCode) : undefined
        )
      )
      .limit(1);
    if (existing.length > 0) {
      throw new ConflictError("Academic group with same department, batch year, and group code already exists");
    }

    const [row] = await tx.insert(academicGroups).values(input).returning();
    if (!row) throw new Error("Failed to create academic group");

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
