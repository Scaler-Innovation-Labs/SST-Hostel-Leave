import { eq } from "drizzle-orm";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { hostels } from "@/db/schema/hostel";
import type { SaveHostelInput } from "@/dto/hostel/save-hostel.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateHostel(id: string, input: SaveHostelInput, currentUser: { id: string }) {
  return transaction(async (tx) => {
    const existing = await tx.select().from(hostels).where(eq(hostels.id, id)).limit(1);
    if (existing.length === 0) {
      throw new NotFoundError("Hostel not found");
    }

    const [row] = await tx.update(hostels).set(input).where(eq(hostels.id, id)).returning();

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.HOSTEL,
      id,
      currentUser.id,
      { code: input.code, name: input.name },
      tx
    );

    return row;
  });
}
