import { inArray } from "drizzle-orm";

import { WORKFLOW_STEP_KEY } from "@/constants/workflow/workflow-step-key";
import { workflowSteps } from "@/db";
import { leaveTypeRepository } from "@/db/repositories/leave/leave-type.repository";
import { db } from "@/lib/db";

export async function listLeaveTypes() {
  const types = await leaveTypeRepository.findAll();

  const workflowIds = types
    .map((t) => t.defaultWorkflowId)
    .filter(Boolean) as string[];

  const pocWorkflowIds = new Set<string>();

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

