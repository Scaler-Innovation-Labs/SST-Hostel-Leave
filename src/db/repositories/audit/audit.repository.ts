import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and,desc, eq, inArray, isNotNull, lt } from "drizzle-orm";

import { auditLogs } from "@/db";
import { db } from "@/lib/db";

export type AuditLog =
  InferSelectModel<typeof auditLogs>;

export type NewAuditLog =
  InferInsertModel<
    typeof auditLogs
  >;

export const auditRepository = {

    async create(
  input: NewAuditLog,
  dbClient: Pick<typeof db, "insert"> = db
): Promise<AuditLog> {
  const rows = await dbClient
    .insert(auditLogs)
    .values(input)
    .returning();

  return rows[0]!;
},

async findByEntity(
  entityType: AuditLog["entityType"],
  entityId: string,
  dbClient: Pick<typeof db, "select"> = db
): Promise<AuditLog[]> {
  // Bounded: entity histories feed admin UIs, never bulk export.
  return dbClient
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(
          auditLogs.entityType,
          entityType
        ),
        eq(
          auditLogs.entityId,
          entityId
        )
      )
    )
    .orderBy(
      desc(auditLogs.createdAt)
    )
    .limit(500);
},

/**
 * Batched history for a set of entities, newest first. Callers pass the ids of
 * one page so annotating a list costs one query instead of one query per row.
 */
async findByEntityIds(
  entityType: AuditLog["entityType"],
  entityIds: string[],
  dbClient: Pick<typeof db, "select"> = db
): Promise<AuditLog[]> {
  if (entityIds.length === 0) {
    return [];
  }

  return dbClient
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.entityType, entityType),
        inArray(auditLogs.entityId, entityIds)
      )
    )
    .orderBy(
      desc(auditLogs.createdAt)
    );
},

/**
 * Retention cleanup: delete audit rows past their expiry. CONFIG_MUTATION
 * rows (expiresAt NULL) are never touched. Returns the deleted row count.
 */
async deleteExpired(now: Date): Promise<number> {
  const rows = await db
    .delete(auditLogs)
    .where(
      and(
        isNotNull(auditLogs.expiresAt),
        lt(auditLogs.expiresAt, now)
      )
    )
    .returning({ id: auditLogs.id });

  return rows.length;
},

};
