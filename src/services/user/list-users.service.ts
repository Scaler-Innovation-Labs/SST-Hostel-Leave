import { userRepository } from "@/db/repositories/user/user.repository";
import type { ListUsersQuery } from "@/dto/user/list-users.dto";

export async function listUsers(query: ListUsersQuery) {
  return userRepository.findAll({
    search: query.search,
    role: query.role,
    excludeRole: query.excludeRole,
    isActive: query.isActive,
    page: query.page,
    limit: query.limit,
  });
}

