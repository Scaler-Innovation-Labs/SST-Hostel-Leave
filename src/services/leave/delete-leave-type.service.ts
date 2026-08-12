import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteLeaveType(id: string, actorUserId: string | null = null) {
  const existing = await leaveTypeRepository.findById(id);
  if (!existing) {
    throw new NotFoundError("LeaveType");
  }

  await leaveTypeRepository.softDelete(id);

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.DELETE,
      AUDIT_ENTITY_TYPE.LEAVE_TYPE,
      id,
      actorUserId,
      { code: existing.code, name: existing.name },
    );
  }
}
