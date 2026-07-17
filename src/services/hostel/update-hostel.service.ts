import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type Hostel,hostelRepository } from "@/db/repositories/hostel/hostel.repository";
import type { SaveHostelInput } from "@/dto/hostel/save-hostel.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateHostel(id: string, input: SaveHostelInput, currentUser: { id: string }): Promise<Hostel> {
  return transaction(async (tx) => {
    const existing = await hostelRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Hostel not found");
    }

    const row = await hostelRepository.updateById(id, input, tx);

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.HOSTEL,
      id,
      currentUser.id,
      { code: input.code, name: input.name },
      tx
    );

    return row!;
  });
}
