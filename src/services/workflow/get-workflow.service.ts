import { type WorkflowDefinitionWithSteps,workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import { NotFoundError } from "@/lib/errors";

export async function getWorkflowById(id: string): Promise<WorkflowDefinitionWithSteps | null> {
  const workflow = await workflowRepository.findDefinitionWithStepsById(id);
  if (!workflow) throw new NotFoundError("WorkflowDefinition");
  return workflow;
}
