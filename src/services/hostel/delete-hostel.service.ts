import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { hostelRepository } from "@/db/repositories/hostel/hostel.repository";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteHostel(id: string, currentUser: { id: string }): Promise<void> {
  return transaction(async (tx) => {
    const existing = await hostelRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Hostel not found");
    }

    await hostelRepository.deleteById(id, tx);

    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.HOSTEL,
      id,
      currentUser.id,
      {},
      tx
    );
  });
}
