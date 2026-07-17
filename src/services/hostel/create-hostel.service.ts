import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { hostels } from "@/db/schema/hostel";
import type { SaveHostelInput } from "@/dto/hostel/save-hostel.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createHostel(input: SaveHostelInput, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(hostels).where(eq(hostels.code, input.code)).limit(1);
    if (existing.length > 0) {
      throw new ConflictError(`Hostel with code ${input.code} already exists`);
    }

    const [row] = await tx.insert(hostels).values(input).returning();
    if (!row) throw new Error("Failed to create hostel");

    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.HOSTEL,
      row.id,
      currentUser.id,
      { code: input.code, name: input.name },
      tx
    );

    return row;
  });
}
