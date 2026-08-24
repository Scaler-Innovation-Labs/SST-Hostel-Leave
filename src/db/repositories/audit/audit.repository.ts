import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { and,desc, eq, isNotNull, lt } from "drizzle-orm";

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
