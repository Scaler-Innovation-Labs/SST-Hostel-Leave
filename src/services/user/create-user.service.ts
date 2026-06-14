import { userRepository as authUserRepository } from "@/db/repositories/auth/user.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import type { CreateUserDto } from "@/dto/user/create-user.dto";
import { db } from "@/lib/db";
import { ConflictError } from "@/lib/errors";

export async function createUser(dto: CreateUserDto) {
  return await db.transaction(async (tx) => {
    // Check for duplicate email
    if (dto.email) {
      const existing = await authUserRepository.findByEmail(dto.email, tx);
      if (existing) {
        throw new ConflictError("Email is already in use");
      }
    }

    const user = await authUserRepository.create({
      fullName: dto.fullName,
      email: dto.email || undefined,
      phone: dto.phone || undefined,
      gender: dto.gender ?? null,
      hostelId: dto.hostelId || undefined,
      isActive: dto.isActive,
    }, tx);

    // Assign roles
    if (dto.roleCodes && dto.roleCodes.length > 0) {
      for (const code of dto.roleCodes) {
        const role = await userRoleRepository.findRoleByCode(code, tx);
        if (role) {
          await userRoleRepository.create(user.id, role.id, tx);
        }
      }
    }

    // Reload with roles
    return userRepository.findByIdWithRoles(user.id, tx);
  });
}

