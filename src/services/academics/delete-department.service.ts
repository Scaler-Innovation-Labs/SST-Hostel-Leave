import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { departmentRepository } from "@/db/repositories/academics/department.repository";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteDepartment(id: string, currentUser: { id: string }): Promise<void> {
  return transaction(async (tx) => {
    const existing = await departmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Department not found");
    }

    await departmentRepository.deleteById(id, tx);

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
