import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import type { SaveWorkflowDto } from "@/dto/workflow/save-workflow.dto";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors";

async function resolveSteps(dto: SaveWorkflowDto, tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) {
  const stepKeys = new Set<string>();
  const steps = [];

  for (const [index, step] of dto.steps.entries()) {
    if (stepKeys.has(step.stepKey)) {
      throw new ValidationError(`Duplicate workflow step key: ${step.stepKey}`);
    }
    stepKeys.add(step.stepKey);

    const role = step.approverRoleCode
      ? await userRoleRepository.findRoleByCode(step.approverRoleCode, tx)
      : null;

    if (step.approverRoleCode && !role) {
      throw new ValidationError(`Unknown approver role: ${step.approverRoleCode}`);
    }

    steps.push({
      stepKey: step.stepKey,
      stepOrder: index + 1,
      approverRoleId: role?.id ?? null,
      isParentApproval: step.isParentApproval,
      approvalMethod: step.approvalMethod ?? null,
      isRequired: step.isRequired,
    });
  }

  return steps;
}

export async function createWorkflow(dto: SaveWorkflowDto) {
  return db.transaction(async (tx) => {
    if (await workflowRepository.findDefinitionByCode(dto.code, tx)) {
      throw new ConflictError("A workflow with this code already exists");
    }

    const steps = await resolveSteps(dto, tx);
    const definition = await workflowRepository.createDefinition(
      {
        code: dto.code,
        name: dto.name,
        description: dto.description ?? null,
        isActive: dto.isActive,
      },
      tx,
    );
    await workflowRepository.replaceSteps(definition.id, steps, tx);
    return workflowRepository.findDefinitionWithStepsById(definition.id, tx);
  });
}

export async function updateWorkflow(id: string, dto: SaveWorkflowDto) {
  return db.transaction(async (tx) => {
    const existing = await workflowRepository.findDefinitionById(id, tx);
    if (!existing) throw new NotFoundError("WorkflowDefinition");

    const codeOwner = await workflowRepository.findDefinitionByCode(dto.code, tx);
    if (codeOwner && codeOwner.id !== id) {
      throw new ConflictError("A workflow with this code already exists");
    }

    const steps = await resolveSteps(dto, tx);
    await workflowRepository.updateDefinition(id, {
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      isActive: dto.isActive,
      version: existing.version + 1,
    }, tx);
    await workflowRepository.replaceSteps(id, steps, tx);
    return workflowRepository.findDefinitionWithStepsById(id, tx);
  });
}
