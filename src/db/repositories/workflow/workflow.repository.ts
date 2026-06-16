import type { InferSelectModel } from "drizzle-orm";
import { and, desc, eq, inArray, like, or, sql } from "drizzle-orm";

import { roles } from "@/db/schema/auth";
import { workflowDefinitions, workflowSteps } from "@/db/schema/workflow";
import { db } from "@/lib/db";
import type { WorkflowStep } from "@/types/workflow/workflow-step";

export type WorkflowDbClient = Pick<typeof db, "select">;
type WorkflowWriteDbClient = Pick<typeof db, "select" | "insert" | "update" | "delete">;

export type WorkflowDefinition = InferSelectModel<typeof workflowDefinitions>;

export type WorkflowDefinitionWithSteps = WorkflowDefinition & {
  steps: Array<WorkflowStep & { approverRoleName: string | null; approverRoleCode: string | null }>;
};

export type WorkflowFilters = {
  isActive?: boolean;
  search?: string;
  page: number;
  limit: number;
};

export const workflowRepository = {
  async findAllDefinitions(
    filters: WorkflowFilters,
    dbClient: WorkflowDbClient = db
  ): Promise<{
    items: WorkflowDefinitionWithSteps[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const conditions: ReturnType<typeof and>[] = [];

    if (filters.isActive !== undefined) {
      conditions.push(eq(workflowDefinitions.isActive, filters.isActive));
    }

    if (filters.search) {
      const pattern = `%${filters.search}%`;
      conditions.push(
        or(
          like(workflowDefinitions.name, pattern),
          like(workflowDefinitions.code, pattern)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const countResult = await dbClient
      .select({ count: sql<number>`count(*)` })
      .from(workflowDefinitions)
      .where(whereClause);

    const total = Number(countResult[0]?.count ?? 0);
    const totalPages = Math.ceil(total / filters.limit);

    const rows = await dbClient
      .select()
      .from(workflowDefinitions)
      .where(whereClause)
      .orderBy(desc(workflowDefinitions.createdAt))
      .limit(filters.limit)
      .offset((filters.page - 1) * filters.limit);

    const defIds = rows.map((d) => d.id);
    let stepsByDefId = new Map<string, Array<WorkflowStep & { approverRoleName: string | null; approverRoleCode: string | null }>>();
    if (defIds.length > 0) {
      const allSteps = await dbClient
        .select()
        .from(workflowSteps)
        .leftJoin(roles, eq(workflowSteps.approverRoleId, roles.id))
        .where(inArray(workflowSteps.workflowDefinitionId, defIds))
        .orderBy(workflowSteps.stepOrder);

      for (const row of allSteps) {
        const step = {
          ...row.workflow_steps,
          approverRoleName: row.roles?.name ?? null,
          approverRoleCode: row.roles?.code ?? null,
        };
        const list = stepsByDefId.get(row.workflow_steps.workflowDefinitionId);
        if (list) {
          list.push(step);
        } else {
          stepsByDefId.set(row.workflow_steps.workflowDefinitionId, [step]);
        }
      }
    }

    const items: WorkflowDefinitionWithSteps[] = rows.map((def) => ({
      ...def,
      steps: stepsByDefId.get(def.id) ?? [],
    }));

    return {
      items,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages,
    };
  },

  async findDefinitionById(
    id: string,
    dbClient: WorkflowDbClient = db
  ): Promise<WorkflowDefinition | null> {
    const rows = await dbClient
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, id))
      .limit(1);

    return rows[0] ?? null;
  },

  async findDefinitionWithStepsById(
    id: string,
    dbClient: WorkflowWriteDbClient = db
  ): Promise<WorkflowDefinitionWithSteps | null> {
    const definition = await this.findDefinitionById(id, dbClient);
    if (!definition) return null;

    const stepRows = await dbClient
      .select()
      .from(workflowSteps)
      .leftJoin(roles, eq(workflowSteps.approverRoleId, roles.id))
      .where(eq(workflowSteps.workflowDefinitionId, id))
      .orderBy(workflowSteps.stepOrder);

    return {
      ...definition,
      steps: stepRows.map((row) => ({
        ...row.workflow_steps,
        approverRoleName: row.roles?.name ?? null,
        approverRoleCode: row.roles?.code ?? null,
      })),
    };
  },

  async findDefinitionByCode(
    code: string,
    dbClient: WorkflowDbClient = db
  ): Promise<WorkflowDefinition | null> {
    const rows = await dbClient
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.code, code))
      .limit(1);

    return rows[0] ?? null;
  },

  async findStepsByWorkflowId(
    workflowId: string,
    dbClient: WorkflowDbClient = db
  ): Promise<WorkflowStep[]> {
    const rows = await dbClient
      .select()
      .from(workflowSteps)
      .where(
        eq(
          workflowSteps.workflowDefinitionId,
          workflowId
        )
      )
      .orderBy(workflowSteps.stepOrder);

    return rows;
  },

  async createDefinition(
    input: typeof workflowDefinitions.$inferInsert,
    dbClient: WorkflowWriteDbClient = db
  ): Promise<WorkflowDefinition> {
    const rows = await dbClient.insert(workflowDefinitions).values(input).returning();
    return rows[0]!;
  },

  async updateDefinition(
    id: string,
    input: Partial<typeof workflowDefinitions.$inferInsert>,
    dbClient: WorkflowWriteDbClient = db
  ): Promise<WorkflowDefinition | null> {
    const rows = await dbClient
      .update(workflowDefinitions)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(workflowDefinitions.id, id))
      .returning();
    return rows[0] ?? null;
  },

  async deleteDefinition(
    id: string,
    dbClient: WorkflowWriteDbClient = db
  ): Promise<void> {
    await dbClient.delete(workflowDefinitions).where(eq(workflowDefinitions.id, id));
  },

  async replaceSteps(
    workflowDefinitionId: string,
    steps: Array<Omit<typeof workflowSteps.$inferInsert, "workflowDefinitionId">>,
    dbClient: WorkflowWriteDbClient = db
  ): Promise<void> {
    await dbClient.delete(workflowSteps).where(eq(workflowSteps.workflowDefinitionId, workflowDefinitionId));
    await dbClient.insert(workflowSteps).values(
      steps.map((step) => ({ ...step, workflowDefinitionId })),
    );
  },
};

export default workflowRepository;
