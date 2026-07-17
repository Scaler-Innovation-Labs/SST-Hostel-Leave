import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type Department,departmentRepository } from "@/db/repositories/academics/department.repository";
import type { SaveDepartmentInput } from "@/dto/department/save-department.dto";
import { transaction } from "@/lib/db/transaction";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function updateDepartment(id: string, input: SaveDepartmentInput, currentUser: { id: string }): Promise<Department> {
  return transaction(async (tx) => {
    const existing = await departmentRepository.findById(id, tx);
    if (!existing) {
      throw new NotFoundError("Department not found");
    }

    const row = await departmentRepository.updateById(id, input, tx);

    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.DEPARTMENT,
      id,
      currentUser.id,
      { code: input.code, name: input.name },
      tx
    );

    return row!;
  });
}
