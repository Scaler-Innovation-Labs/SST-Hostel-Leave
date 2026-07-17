import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { departments } from "@/db/schema/academics";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteDepartment(id: string, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(departments).where(eq(departments.id, id)).limit(1);
    if (existing.length === 0) {
      throw new NotFoundError("Department not found");
    }

    await tx.delete(departments).where(eq(departments.id, id));

    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.DEPARTMENT,
      id,
      currentUser.id,
      {},
      tx
    );
  });
}
