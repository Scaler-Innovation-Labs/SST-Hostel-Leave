import type {
  AuditAction,
} from "@/constants/audit/audit-action";
import type {
  AuditEntityType,
} from "@/constants/audit/audit-entity-type";
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
