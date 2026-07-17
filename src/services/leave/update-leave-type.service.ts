import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import type { SaveLeaveTypeDto } from "@/dto/leave/save-leave-type.dto";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function updateLeaveType(id: string, dto: Partial<SaveLeaveTypeDto>) {
  const existing = await leaveTypeRepository.findById(id);
  if (!existing) {
    throw new NotFoundError("LeaveType");
  }

  const code = dto.code ?? existing.code;
  if (code !== existing.code) {
    const duplicate = await leaveTypeRepository.findByCode(code);
    if (duplicate) {
      throw new ConflictError(`Leave type with code "${code}" already exists`);
    }
  }

  return leaveTypeRepository.update(id, {
    code,
    name: dto.name ?? existing.name,
    category: dto.category ?? existing.category,
    description: dto.description !== undefined ? dto.description : existing.description,
    workflowMode: dto.workflowMode ?? existing.workflowMode,
    qrMode: dto.qrMode ?? existing.qrMode,
    defaultWorkflowId: dto.defaultWorkflowId !== undefined ? dto.defaultWorkflowId : existing.defaultWorkflowId,
    allowExtensions: dto.allowExtensions ?? existing.allowExtensions,
    maxExtensionCount: dto.maxExtensionCount !== undefined ? dto.maxExtensionCount : existing.maxExtensionCount,
    isActive: dto.isActive ?? existing.isActive,
    formSchema: dto.formSchema ?? existing.formSchema,
    requiredDocuments: dto.requiredDocuments !== undefined ? dto.requiredDocuments : existing.requiredDocuments,
    notificationConfig: dto.notificationConfig !== undefined ? dto.notificationConfig : existing.notificationConfig,
    uiConfig: dto.uiConfig !== undefined ? dto.uiConfig : existing.uiConfig,
    useGlobalNotificationRules: dto.useGlobalNotificationRules ?? existing.useGlobalNotificationRules,
    policyConfig: dto.policyConfig !== undefined ? dto.policyConfig : existing.policyConfig,
    metadata: dto.metadata !== undefined ? dto.metadata : existing.metadata,
  });
}
