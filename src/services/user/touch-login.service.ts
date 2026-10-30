import { userRepository } from "@/db/repositories/user/user.repository";

export async function touchUserLastLogin(userId: string): Promise<void> {
  await userRepository.touchLastLogin(userId);
}
