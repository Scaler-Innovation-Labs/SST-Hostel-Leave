import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import type { CreateLeaveTypeDto } from "@/dto/leave/save-leave-type.dto";
import { ConflictError } from "@/lib/errors";

export async function createLeaveType(dto: CreateLeaveTypeDto) {
  const existing = await leaveTypeRepository.findByCode(dto.code);
  if (existing) {
    throw new ConflictError(`Leave type with code ${dto.code} already exists`);
  }

  return leaveTypeRepository.create({
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
    uiConfig: dto.uiConfig ?? null,
    useGlobalNotificationRules: dto.useGlobalNotificationRules,
    policyConfig: dto.policyConfig ?? null,
    metadata: dto.metadata ?? null,
    deletedAt: null,
  });
}
