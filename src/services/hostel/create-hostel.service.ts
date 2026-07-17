import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type Hostel,hostelRepository } from "@/db/repositories/hostel/hostel.repository";
import type { SaveHostelInput } from "@/dto/hostel/save-hostel.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createHostel(input: SaveHostelInput, currentUser: { id: string }): Promise<Hostel> {
  return transaction(async (tx) => {
    const existing = await hostelRepository.findByCode(input.code, tx);
    if (existing) {
      throw new ConflictError(`Hostel with code ${input.code} already exists`);
    }

    const row = await hostelRepository.create(input, tx);

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
