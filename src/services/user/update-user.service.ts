import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository, type UserWithRoles } from "@/db/repositories/user/user.repository";
import type { UpdateUserDto } from "@/dto/user/update-user.dto";
import { ROLES } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function updateUser(id: string, dto: UpdateUserDto): Promise<UserWithRoles | null> {
  const existing = await userRepository.findById(id, db);

  if (!existing) {
    throw new NotFoundError("User");
  }

  return await db.transaction(async (tx) => {
    if (dto.email && dto.email !== existing.email) {
      const emailUser = await userRepository.findByEmail(dto.email, tx);
      if (emailUser && emailUser.id !== id) {
        throw new ConflictError("Email is already in use");
      }
    }

    await userRepository.updateUser(id, {
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      slackId: dto.slackId === undefined ? undefined : (dto.slackId || null),
      gender: dto.gender,
      hostelId: dto.hostelId,
      isActive: dto.isActive,
    }, tx);

    if (dto.roleCodes !== undefined) {
      // Guard: never remove the last super admin (would lock everyone out).
      if (!dto.roleCodes.includes(ROLES.SUPER_ADMIN)) {
        const currentRoleCodes = await userRoleRepository.findRoleCodesByUserId(id, tx);
        if (currentRoleCodes.includes(ROLES.SUPER_ADMIN)) {
          const superAdminIds = await userRoleRepository.findUserIdsByRoleCode(ROLES.SUPER_ADMIN);
          if (superAdminIds.filter((uid) => uid !== id).length === 0) {
            throw new ConflictError("Cannot remove the last super admin");
          }
        }
      }

      const rolesByCode = new Map(
        (await userRoleRepository.findRolesByCodes(dto.roleCodes, tx)).map((r) => [r.code, r.id])
      );
      const roleIds = dto.roleCodes.map((code) => rolesByCode.get(code)).filter((id): id is string => !!id);
      await userRepository.replaceRoles(id, roleIds, tx);
    }

    if (dto.roleScopes !== undefined) {
      const rolesByCode = new Map(
        (await userRoleRepository.findRolesByCodes(
          dto.roleScopes.map((s) => s.roleCode),
          tx
        )).map((r) => [r.code, r.id])
      );
      for (const { roleCode, hostelIds } of dto.roleScopes) {
        const roleId = rolesByCode.get(roleCode);
        if (roleId) {
          await userRoleRepository.replaceRoleScopes(
            id,
            roleId,
            ROLE_SCOPE_TYPE.HOSTEL,
            hostelIds,
            tx
          );
        }
      }
    }

    return userRepository.findByIdWithRoles(id, tx);
  });
}

