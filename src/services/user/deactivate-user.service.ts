import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { type User,userRepository } from "@/db/repositories/user/user.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function deactivateUser(id: string, actorUserId: string | null = null): Promise<User> {
  const user = await userRepository.deactivate(id, db);

  if (!user) {
    throw new NotFoundError("User");
  }

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.USER,
      id,
      actorUserId,
      { action: "DEACTIVATE" },
    );
  }

  return user;
}

export async function activateUser(id: string, actorUserId: string | null = null): Promise<User> {
  const user = await userRepository.activate(id, db);

  if (!user) {
    throw new NotFoundError("User");
  }

  if (actorUserId) {
    await auditService.record(
      AUDIT_ACTION.UPDATE,
      AUDIT_ENTITY_TYPE.USER,
      id,
      actorUserId,
      { action: "ACTIVATE" },
    );
  }

  return user;
}

