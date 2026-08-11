import { ROLE_SCOPE_TYPE } from "@/constants/auth/role-scope";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository, type UserWithRoles } from "@/db/repositories/user/user.repository";
import type { CreateUserDto } from "@/dto/user/create-user.dto";
import { db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";

export async function createUser(dto: CreateUserDto): Promise<UserWithRoles | null> {
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
      for (const code of dto.roleCodes) {
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

    return userRepository.findByIdWithRoles(user.id, tx);
  });
}

