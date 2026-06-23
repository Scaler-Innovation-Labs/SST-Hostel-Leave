import { workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export async function deleteWorkflow(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await workflowRepository.findDefinitionById(id, tx);
    if (!existing) throw new NotFoundError("WorkflowDefinition");

    await workflowRepository.deleteDefinition(id, tx);
  });
}
