import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deleteWorkflow(id: string, actorUserId: string | null = null): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await workflowRepository.findDefinitionById(id, tx);
    if (!existing) throw new NotFoundError("WorkflowDefinition");

    await workflowRepository.deleteDefinition(id, tx);

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.DELETE,
        AUDIT_ENTITY_TYPE.WORKFLOW,
        id,
        actorUserId,
        { code: existing.code, name: existing.name },
        tx,
      );
    }
  });
}
