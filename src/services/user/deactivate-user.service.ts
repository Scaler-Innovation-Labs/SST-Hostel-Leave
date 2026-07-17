import { type User,userRepository } from "@/db/repositories/user/user.repository";
import { db } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";

export async function deactivateUser(id: string): Promise<User> {
  const user = await userRepository.deactivate(id, db);

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}

export async function activateUser(id: string): Promise<User> {
  const user = await userRepository.activate(id, db);

  if (!user) {
    throw new NotFoundError("User");
  }

  return user;
}

