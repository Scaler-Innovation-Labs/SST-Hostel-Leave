import { userRepository, type UserWithRoles } from "@/db/repositories/user/user.repository";
import { NotFoundError } from "@/lib/errors";

export async function getUser(id: string): Promise<UserWithRoles> {
  const user = await userRepository.findByIdWithRoles(id);

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}

