import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { LEAVE_TYPE_COLOR_PALETTE } from "@/constants/leave/leave-category";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import type { CreateLeaveTypeDto } from "@/dto/leave/save-leave-type.dto";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";
import { leaveTypeVersionService } from "@/services/leave/leave-type-version.service";

export async function createLeaveType(dto: CreateLeaveTypeDto, actorUserId: string | null = null) {
  const existing = await leaveTypeRepository.findByCode(dto.code);
  if (existing) {
    throw new ConflictError(`Leave type with code ${dto.code} already exists`);
  }

  const existingTypes = await leaveTypeRepository.findAllIncludingInactive();
  const uiConfig = (dto.uiConfig ?? {}) as Record<string, unknown>;
  if (uiConfig.color === undefined) {
    uiConfig.color = LEAVE_TYPE_COLOR_PALETTE[existingTypes.length % LEAVE_TYPE_COLOR_PALETTE.length];
  }

  const leaveType = await leaveTypeRepository.create({
    code: dto.code,
    name: dto.name,
    category: dto.category,
    description: dto.description ?? null,
    workflowMode: dto.workflowMode,
    qrMode: dto.qrMode,
    defaultWorkflowId: dto.defaultWorkflowId ?? null,
    allowExtensions: dto.allowExtensions,
    maxExtensionCount: dto.maxExtensionCount ?? null,
    isActive: dto.isActive,
    formSchema: dto.formSchema,
    requiredDocuments: dto.requiredDocuments ?? null,
    notificationConfig: dto.notificationConfig ?? null,
    uiConfig,
    useGlobalNotificationRules: dto.useGlobalNotificationRules,
    policyConfig: dto.policyConfig ?? null,
    metadata: dto.metadata ?? null,
    deletedAt: null,
  });

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.CREATE,
      AUDIT_ENTITY_TYPE.LEAVE_TYPE,
      leaveType.id,
      actorUserId,
      { code: dto.code, name: dto.name },
    );
  }

  // Seed the immutable version chain with v1 so leaves created under this
  // type get a stable execution context from day one.
  await leaveTypeVersionService.createVersion(leaveType.id, actorUserId);

  return leaveType;
}
