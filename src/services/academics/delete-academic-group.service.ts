import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { academicGroups } from "@/db/schema/academics";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteAcademicGroup(id: string, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(academicGroups).where(eq(academicGroups.id, id)).limit(1);
    if (existing.length === 0) {
      throw new NotFoundError("Academic group not found");
    }

    await tx.delete(academicGroups).where(eq(academicGroups.id, id));

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
