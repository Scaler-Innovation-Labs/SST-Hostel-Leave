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
    defaultWorkflowId: dto.defaultWorkflowId ?? null,
    allowExtensions: dto.allowExtensions,
    maxExtensionCount: dto.maxExtensionCount ?? null,
    isActive: dto.isActive,
    formSchema: dto.formSchema,
    policyConfig: dto.policyConfig ?? null,
    notificationConfig: null,
    requiredDocuments: null,
    uiConfig: null,
    metadata: null,
    deletedAt: null,
  });
}
