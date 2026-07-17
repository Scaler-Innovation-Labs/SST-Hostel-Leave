import { inArray } from "drizzle-orm";
import { workflowSteps } from "@/db";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { db } from "@/lib/db";
import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";

export async function listLeaveTypes() {
  const types = await leaveTypeRepository.findAll();

  const workflowIds = types
    .map((t) => t.defaultWorkflowId)
    .filter(Boolean) as string[];

  let pocWorkflowIds = new Set<string>();

  if (workflowIds.length > 0) {
    const steps = await db
      .select()
      .from(workflowSteps)
      .where(
        inArray(workflowSteps.workflowDefinitionId, workflowIds),
      );

    for (const step of steps) {
      if (step.stepKey === WORKFLOW_STEP_KEY.POC_APPROVAL) {
        pocWorkflowIds.add(step.workflowDefinitionId);
      }
    }
  }

  return types.map((t) => ({
    ...t,
    requiresPoc: t.defaultWorkflowId
      ? pocWorkflowIds.has(t.defaultWorkflowId)
      : false,
  }));
}

