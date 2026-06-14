import type { InferSelectModel } from "drizzle-orm";
import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";

import { policies } from "@/db";
import { db } from "@/lib/db";

export type Policy = InferSelectModel<typeof policies>;

type PolicyDbClient = Pick<typeof db, "select">;
type PolicyWriteDbClient = Pick<typeof db, "select" | "insert" | "update">;

export const policyRepository = {
  async findActiveByLeaveTypeId(
    leaveTypeId: string,
    hostelId: string | null,
    at: Date,
    dbClient: PolicyDbClient = db,
    context?: {
      studentDepartmentId?: string | null;
      studentBatchYear?: number | null;
    }
  ): Promise<Policy[]> {
    const conditions: ReturnType<typeof and>[] = [
      eq(policies.isActive, true),
      or(
        eq(policies.leaveTypeId, leaveTypeId),
        sql`${policies.leaveTypeId} IS NULL`
      ),
      hostelId ? or(eq(policies.hostelId, hostelId), isNull(policies.hostelId)) : isNull(policies.hostelId),
      or(lte(policies.startsAt, at), sql`${policies.startsAt} IS NULL`),
      or(gte(policies.endsAt, at), sql`${policies.endsAt} IS NULL`),
    ];

    // Department filter: match if policy has no department restriction OR matches student's department
    if (context?.studentDepartmentId) {
      conditions.push(
        or(
          isNull(policies.departmentId),
          eq(policies.departmentId, context.studentDepartmentId),
        ),
      );
    } else {
      conditions.push(isNull(policies.departmentId));
    }

    // Batch year filter: match if policy has no batch restriction OR matches student's batch
    if (context?.studentBatchYear != null) {
      conditions.push(
        or(
          isNull(policies.batchYear),
          eq(policies.batchYear, context.studentBatchYear),
        ),
      );
    } else {
      conditions.push(isNull(policies.batchYear));
    }

    const rows = await dbClient
      .select()
      .from(policies)
      .where(and(...conditions))
      .orderBy(desc(policies.priority));

    return rows;
  },

  async findAll(dbClient: PolicyDbClient = db): Promise<Policy[]> {
    return dbClient.select().from(policies).orderBy(desc(policies.priority), asc(policies.name));
  },

  async findById(id: string, dbClient: PolicyDbClient = db): Promise<Policy | null> {
    const rows = await dbClient.select().from(policies).where(eq(policies.id, id)).limit(1);
    return rows[0] ?? null;
  },

  async create(input: typeof policies.$inferInsert, dbClient: PolicyWriteDbClient = db): Promise<Policy> {
    const rows = await dbClient.insert(policies).values(input).returning();
    return rows[0]!;
  },

  async update(id: string, input: Partial<typeof policies.$inferInsert>, dbClient: PolicyWriteDbClient = db): Promise<Policy | null> {
    const rows = await dbClient.update(policies).set({ ...input, updatedAt: new Date() }).where(eq(policies.id, id)).returning();
    return rows[0] ?? null;
  },
};

export default policyRepository;
