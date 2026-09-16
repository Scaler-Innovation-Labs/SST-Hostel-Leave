import {
  type ActingRef,
  actorDescriptor,
} from "@/constants/audit/actor";
import type {
  AuditAction,
} from "@/constants/audit/audit-action";
import type {
  AuditEntityType,
} from "@/constants/audit/audit-entity-type";
import {
  resolveAuditExpiresAt,
  resolveAuditRetentionClass,
} from "@/constants/audit/audit-retention";
import { auditRepository } from "@/db/repositories/audit/audit.repository";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import type { ListAuditQuery } from "@/dto/audit/list-audit.dto";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { db } from "@/lib/db";
import { AuthorizationError } from "@/lib/errors";

type AuditServiceDbClient = Pick<typeof db, "insert">;
type AuditSelectDbClient = Pick<typeof db, "select">;

/**
 * The actor of an audited write: a `users.id`, nothing, or an `ActingRef`.
 *
 * `audit_logs.actor_user_id` is a uuid with a foreign key to `users`, so the
 * only values it can hold are a real user id or NULL. Automated work (cron
 * passes) and off-platform actors (a parent approving over SMS) have no user
 * account, so they resolve to NULL and carry an actor descriptor in metadata
 * instead — see `actorDescriptor`.
 */
export type AuditActor = string | null | ActingRef;

/** Only a user id or NULL can be stored in the uuid FK column. */
function resolveActorUserId(actor: AuditActor): string | null {
  if (actor === null || typeof actor === "string") {
    return actor;
  }

  return actor.id;
}

/** A described actor explains itself in metadata, not in the FK column. */
function withActorDescriptor(
  actor: AuditActor,
  metadata: Record<string, unknown>
): Record<string, unknown> {
  if (actor === null || typeof actor === "string") {
    return metadata;
  }

  return { ...actorDescriptor(actor), ...metadata };
}

export const auditService = {
  async record(
    action: AuditAction,
    entityType: AuditEntityType,
    entityId: string,
    actor: AuditActor,
    metadata: Record<string, unknown>,
    dbClient: AuditServiceDbClient = db
  ) {
    // Retention is derived from what happened: configuration mutations keep
    // full snapshots forever; state transitions and user sessions expire so
    // the audit table cannot outgrow the core tables it tracks.
    const retentionClass = resolveAuditRetentionClass(entityType, action);

    return auditRepository.create(
      {
        action,
        entityType,
        entityId,
        actorUserId: resolveActorUserId(actor),
        metadata: withActorDescriptor(actor, metadata),
        retentionClass,
        expiresAt: resolveAuditExpiresAt(retentionClass),
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

  async listAuditLogs(query: ListAuditQuery, currentUser: CurrentUser) {
    if (!currentUser.roles.some(r => r === ROLES.ADMIN || r === ROLES.SUPER_ADMIN)) {
      const student = await studentRepository.findByUserId(currentUser.id);
      if (!student) {
        throw new AuthorizationError("Access denied");
      }
      if (query.entityType !== "LEAVE_REQUEST") {
        throw new AuthorizationError("Access denied");
      }
      const leave = await leaveRepository.findById(query.entityId);
      if (!leave || leave.studentId !== student.id) {
        throw new AuthorizationError("Access denied");
      }
    }

    return auditRepository.findByEntity(
      query.entityType as AuditEntityType,
      query.entityId,
    );
  },
};
