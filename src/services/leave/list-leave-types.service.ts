import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { type LeaveType,leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { workflowRepository } from "@/db/repositories/workflow/workflow.repository";

export async function listLeaveTypes(): Promise<(LeaveType & { requiresPoc: boolean; requiresParentApproval: boolean })[]> {
  const types = await leaveTypeRepository.findAll();

  const workflowIds = types
    .map((t) => t.defaultWorkflowId)
    .filter(Boolean) as string[];

  const pocWorkflowIds = new Set<string>();
  const parentWorkflowIds = new Set<string>();

  if (workflowIds.length > 0) {
    const steps = await workflowRepository.findStepsByWorkflowIds(workflowIds);

    for (const step of steps) {
      if (step.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL) {
        pocWorkflowIds.add(step.workflowDefinitionId);
      }
      if (step.isParentApproval || step.stepKey === WORKFLOW_STEP_KEY.PARENT_APPROVAL) {
        parentWorkflowIds.add(step.workflowDefinitionId);
      }
    }
  }

  return types.map((t) => ({
    ...t,
    requiresPoc: t.defaultWorkflowId
      ? pocWorkflowIds.has(t.defaultWorkflowId)
      : false,
    requiresParentApproval: t.defaultWorkflowId
      ? parentWorkflowIds.has(t.defaultWorkflowId)
      : false,
  }));
}

