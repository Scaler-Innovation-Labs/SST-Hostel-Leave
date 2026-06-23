import { workflowRepository } from "@/db/repositories/workflow/workflow.repository";
import type { Database } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { WorkflowStep } from "@/types/workflow/workflow-step";

type WorkflowEngineDbClient = Pick<Database, "select">;

export const workflowEngine = {
  async resolve(
    workflowId: string,
    dbClient: WorkflowEngineDbClient
  ): Promise<{ definition: { id: string; isActive: boolean; version: number }; steps: WorkflowStep[] }> {
    const definition = await workflowRepository.findDefinitionById(workflowId, dbClient);

    if (!definition) {
      throw new NotFoundError("WorkflowDefinition");
    }

    if (!definition.isActive) {
      throw new NotFoundError("WorkflowDefinition");
    }

    const steps = await workflowRepository.findStepsByWorkflowId(
      workflowId,
      dbClient
    );

    return {
      definition: {
        id: definition.id,
        isActive: definition.isActive,
        version: definition.version,
      },
      steps,
    };
  },

  getFirstStep(
    steps: WorkflowStep[]
  ): WorkflowStep | null {
    if (steps.length === 0) return null;
    return steps.reduce((earliest, step) =>
      step.stepOrder < earliest.stepOrder ? step : earliest
    );
  },

  getNextStep(
    steps: WorkflowStep[],
    currentStepOrder: number
  ): WorkflowStep | null {
    const nextSteps = steps
      .filter((s) => s.stepOrder > currentStepOrder)
      .sort((a, b) => a.stepOrder - b.stepOrder);

    return nextSteps[0] ?? null;
  },

  isFinalStep(
    steps: WorkflowStep[],
    currentStepOrder: number
  ): boolean {
    return steps.every((s) => s.stepOrder <= currentStepOrder);
  },
};

