import { userRepository } from "@/db/repositories/user/user.repository";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import type { CreateUserDto } from "@/dto/user/create-user.dto";
import { db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";

export async function createUser(dto: CreateUserDto) {
  return await db.transaction(async (tx) => {
    if (dto.email) {
      const existing = await userRepository.findByEmail(dto.email, tx);
      if (existing) {
        throw new ConflictError("Email is already in use");
      }
    }

    const user = await userRepository.create({
      fullName: dto.fullName,
      email: dto.email || undefined,
      phone: dto.phone || undefined,
      gender: dto.gender ?? null,
      hostelId: dto.hostelId || undefined,
      isActive: dto.isActive,
    }, tx);

    if (dto.roleCodes && dto.roleCodes.length > 0) {
      const rolesByCode = new Map(
        (await userRoleRepository.findRolesByCodes(dto.roleCodes, tx)).map((r) => [r.code, r.id])
      );
      for (const code of dto.roleCodes) {
        const roleId = rolesByCode.get(code);
        if (roleId) {
          await userRoleRepository.create(user.id, roleId, tx);
        }
      }
    }

    return userRepository.findByIdWithRoles(user.id, tx);
  });
}

