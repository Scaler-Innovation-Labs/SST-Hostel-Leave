import { currentUser } from "@clerk/nextjs/server";

import { userRepository } from "@/db/repositories/user/user.repository";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";

import { isRole } from "./roles";
import type { CurrentUser } from "./types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;

  const dbUser = await userRepository.findByClerkId(clerkUser.id);

  if (!dbUser) {
    return null;
  }

  const roleCodes = await userRoleRepository.findRoleCodesByUserId(dbUser.id);
  const roles = roleCodes.filter(isRole);

  const currentUserValue: CurrentUser = {
    id: dbUser.id,
    clerkId: clerkUser.id,
    email,
    roles,
  };

  return currentUserValue;
}
