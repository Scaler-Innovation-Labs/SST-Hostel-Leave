import { roleRepository } from "@/db/repositories/auth/role.repository";

export async function listRoles() {
  return roleRepository.findAll();
}
