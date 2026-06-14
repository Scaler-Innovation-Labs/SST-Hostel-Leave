import { eq } from "drizzle-orm";

import { userRepository as authUserRepository } from "@/db/repositories/auth/user.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRoles, users } from "@/db";
import type { UpdateUserDto } from "@/dto/user/update-user.dto";
import { db } from "@/lib/db";
import { ConflictError, NotFoundError } from "@/lib/errors";

export async function updateUser(id: string, dto: UpdateUserDto) {
  const existing = await userRepository.findById(id, db);

  if (!existing) {
    throw new NotFoundError("User");
  }

  return await db.transaction(async (tx) => {
    // Check for duplicate email (if changing email)
    if (dto.email && dto.email !== existing.email) {
      const emailUser = await authUserRepository.findByEmail(dto.email, tx);
      if (emailUser && emailUser.id !== id) {
        throw new ConflictError("Email is already in use");
      }
    }

    // Update user fields
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (dto.fullName !== undefined) updateData.fullName = dto.fullName;
    if (dto.email !== undefined) updateData.email = dto.email || null;
    if (dto.phone !== undefined) updateData.phone = dto.phone || null;
    if (dto.gender !== undefined) updateData.gender = dto.gender;
    if (dto.hostelId !== undefined) updateData.hostelId = dto.hostelId;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;

    await tx
      .update(users)
      .set(updateData)
      .where(eq(users.id, id));

    // Update roles if provided
    if (dto.roleCodes !== undefined) {
      // Remove all existing roles
      await tx
        .delete(userRoles)
        .where(eq(userRoles.userId, id));

      // Assign new roles
      for (const code of dto.roleCodes) {
        const role = await userRoleRepository.findRoleByCode(code, tx);
        if (role) {
          await userRoleRepository.create(id, role.id, tx);
        }
      }
    }

    return userRepository.findByIdWithRoles(id, tx);
  });
}

