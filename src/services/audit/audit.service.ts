import type {
  AuditAction,
} from "@/constants/audit/audit-action";
import type {
  AuditEntityType,
} from "@/constants/audit/audit-entity-type";
import { auditRepository } from "@/db/repositories/audit/audit.repository";
import type { ListAuditQuery } from "@/dto/audit/list-audit.dto";
import { db } from "@/lib/db";

type AuditServiceDbClient = Pick<typeof db, "insert">;
type AuditSelectDbClient = Pick<typeof db, "select">;

export const auditService = {
  async record(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    actorUserId: string | null,
    metadata: Record<string, unknown>,
    dbClient: AuditServiceDbClient = db
  ) {
    return auditRepository.create(
      {
        action,
        entityType,
        entityId,
        actorUserId,
        metadata,
      },
      dbClient
    );
  },

  async findByEntity(
    query: ListAuditQuery,
    dbClient: AuditSelectDbClient = db
  ) {
    return auditRepository.findByEntity(
      query.entityType as AuditEntityType,
      query.entityId,
      dbClient
    );
  },
};
