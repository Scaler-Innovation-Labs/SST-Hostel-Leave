import {
  type WorkflowDefinitionWithSteps,
  workflowRepository,
} from "@/db/repositories/workflow/workflow.repository";
import {
  type WorkflowVersion,
  workflowVersionRepository,
} from "@/db/repositories/workflow/workflow-version.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

type VersionDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

/** The step shape frozen into workflow_versions.steps. */
export type FrozenWorkflowStep = {
  stepKey: string;
  stepOrder: number;
  approverRoleCode: string | null;
  isParentApproval: boolean;
  approvalMethod: string | null;
  isRequired: boolean;
};

function freezeSteps(workflow: WorkflowDefinitionWithSteps): FrozenWorkflowStep[] {
  return workflow.steps.map((step) => ({
    stepKey: step.stepKey,
    stepOrder: step.stepOrder,
    approverRoleCode: step.approverRoleCode,
    isParentApproval: step.isParentApproval,
    approvalMethod: step.approvalMethod ?? null,
    isRequired: step.isRequired,
  }));
}

export const workflowVersionService = {
  /**
   * Creates a new immutable version of a workflow, freezing its definition
   * and steps (with role codes resolved). Called only when the workflow is
   * created or changed. Existing versions are never mutated.
   */
  async createVersion(
    workflowDefinitionId: string,
    actorUserId: string | null = null,
    dbClient: VersionDbClient = db
  ): Promise<WorkflowVersion> {
    const workflow = await workflowRepository.findDefinitionWithStepsById(workflowDefinitionId, dbClient);
    if (!workflow) {
      throw new NotFoundError("WorkflowDefinition");
    }

    const version = await workflowVersionRepository.nextVersion(workflowDefinitionId, dbClient);

    return workflowVersionRepository.create(
      {
        workflowDefinitionId,
        version,
        code: workflow.code,
        name: workflow.name,
        description: workflow.description,
        isActive: workflow.isActive,
        steps: freezeSteps(workflow),
        createdBy: actorUserId,
      },
      dbClient
    );
  },

  /**
   * Returns the latest version of a workflow. Version creation happens only
   * on actual configuration mutation (createVersion); the runtime never
   * repairs missing versions — a missing version is a data error.
   */
  async getLatestVersion(
    workflowDefinitionId: string,
    dbClient: VersionDbClient = db
  ): Promise<WorkflowVersion> {
    const existing = await workflowVersionRepository.findLatestByWorkflowDefinitionId(workflowDefinitionId, dbClient);
    if (!existing) {
      throw new NotFoundError(`WorkflowVersion for workflow ${workflowDefinitionId}`);
    }

    return existing;
  },
};

export default workflowVersionService;