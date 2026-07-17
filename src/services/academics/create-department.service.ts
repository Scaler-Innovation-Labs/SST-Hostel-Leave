import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { departments } from "@/db/schema/academics";
import type { SaveDepartmentInput } from "@/dto/department/save-department.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createDepartment(input: SaveDepartmentInput, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(departments).where(eq(departments.code, input.code)).limit(1);
    if (existing.length > 0) {
      throw new ConflictError(`Department with code ${input.code} already exists`);
    }

    const [row] = await tx.insert(departments).values(input).returning();
    if (!row) throw new Error("Failed to create department");

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.DEPARTMENT,
      row.id,
      currentUser.id,
      { code: input.code, name: input.name },
      tx
    );

    return row;
  });
}
