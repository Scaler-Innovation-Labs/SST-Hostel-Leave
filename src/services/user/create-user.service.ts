import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository, type UserWithRoles } from "@/db/repositories/user/user.repository";
import type { CreateUserDto } from "@/dto/user/create-user.dto";
import { db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";
import { auditService } from "@/services/audit/audit.service";

export async function createUser(dto: CreateUserDto, actorUserId: string | null = null): Promise<UserWithRoles | null> {
  return await db.transaction(async (tx) => {
    if (dto.email) {
      const existingEmail = await userRepository.findByEmail(dto.email, tx);
      if (existingEmail) {
        throw new ConflictError("Email is already in use");
      }
    }

    if (dto.phone) {
      const existingPhone = await userRepository.findByPhone(dto.phone, tx);
      if (existingPhone) {
        throw new ConflictError("Phone number is already in use");
      }
    }

    let user;
    try {
      user = await userRepository.create({
        fullName: dto.fullName,
        email: dto.email || undefined,
        phone: dto.phone || undefined,
        slackId: dto.slackId || undefined,
        gender: dto.gender ?? null,
        hostelId: dto.hostelId || undefined,
        isActive: dto.isActive,
      }, tx);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message.includes("users_phone_unique") || message.includes("duplicate key") && message.includes("phone")) {
        throw new ConflictError("Phone number is already in use");
      }
      if (message.includes("users_email_unique") || message.includes("duplicate key") && message.includes("email")) {
        throw new ConflictError("Email is already in use");
      }
      throw err;
    }

    const roleIdsByCode = new Map<string, string>(
      (await userRoleRepository.findRolesByCodes(
        [...new Set([...(dto.roleCodes ?? []), ...(dto.roleScopes?.map((s) => s.roleCode) ?? [])])],
        tx
      )).map((r) => [r.code, r.id])
    );

    if (dto.roleCodes && dto.roleCodes.length > 0) {
      // Roles with hostel scopes are assigned by roleScopes below — a global
      // (unscoped) row for the same role would duplicate the assignment.
      // Empty hostelIds means "all hostels", which stays a global row.
      const scopedCodes = new Set(
        (dto.roleScopes ?? [])
          .filter((s) => s.hostelIds.length > 0)
          .map((s) => s.roleCode)
      );
      for (const code of dto.roleCodes) {
        if (scopedCodes.has(code)) continue;
        const roleId = roleIdsByCode.get(code);
        if (roleId) {
          await userRoleRepository.create(user.id, roleId, tx);
        }
      }
    }

    if (dto.roleScopes?.length) {
      for (const { roleCode, hostelIds } of dto.roleScopes) {
        const roleId = roleIdsByCode.get(roleCode);
        if (roleId) {
          await userRoleRepository.replaceRoleScopes(
            user.id,
            roleId,
            ROLE_SCOPE_TYPE.HOSTEL,
            hostelIds,
            tx
          );
        }
      }
    }

    const result = await userRepository.findByIdWithRoles(user.id, tx);

    if (actorUserId) {
      await auditService.record(
        AUDIT_ACTION.CREATE,
        AUDIT_ENTITY_TYPE.USER,
        user.id,
        actorUserId,
        { fullName: dto.fullName, email: dto.email, roleCodes: dto.roleCodes, roleScopes: dto.roleScopes },
        tx,
      );
    }

    return result;
  });
}

