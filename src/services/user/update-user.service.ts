import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository, type UserWithRoles } from "@/db/repositories/user/user.repository";
import type { UpdateUserDto } from "@/dto/user/update-user.dto";
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
      gender: dto.gender,
      hostelId: dto.hostelId,
      isActive: dto.isActive,
    }, tx);

    if (dto.roleCodes !== undefined) {
      const rolesByCode = new Map(
        (await userRoleRepository.findRolesByCodes(dto.roleCodes, tx)).map((r) => [r.code, r.id])
      );
      const roleIds = dto.roleCodes.map((code) => rolesByCode.get(code)).filter((id): id is string => !!id);
      await userRepository.replaceRoles(id, roleIds, tx);
    }

    return userRepository.findByIdWithRoles(id, tx);
  });
}

