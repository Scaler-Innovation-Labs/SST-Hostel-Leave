import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type Department,departmentRepository } from "@/db/repositories/academics/department.repository";
import type { SaveDepartmentInput } from "@/dto/department/save-department.dto";
import { transaction } from "@/lib/db/transaction";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createDepartment(input: SaveDepartmentInput, currentUser: { id: string }): Promise<Department> {
  return transaction(async (tx) => {
    const existing = await departmentRepository.findByCode(input.code, tx);
    if (existing) {
      throw new ConflictError(`Department with code ${input.code} already exists`);
    }

    const row = await departmentRepository.create(input, tx);

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
