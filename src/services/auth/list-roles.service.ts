import { type Role,roleRepository } from "@/db/repositories/auth/role.repository";

export async function listRoles(): Promise<Role[]> {
  return roleRepository.findAll();
}
