import { type WorkflowDefinitionWithSteps,workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import type { ListWorkflowsQuery } from "@/dto/workflow/list-workflows.dto";

export async function listWorkflows(query: ListWorkflowsQuery): Promise<{
  items: WorkflowDefinitionWithSteps[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  return workflowRepository.findAllDefinitions({
    search: query.search,
    isActive: query.isActive,
    page: query.page,
    limit: query.limit,
  });
}

