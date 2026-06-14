import { currentUser } from "@clerk/nextjs/server";

import { userRepository } from "@/db/repositories/auth/user.repository";
import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";

import { isRole } from "./roles";
import type { CurrentUser } from "./types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;

  // 1. Try finding by clerkId
  let dbUser = await userRepository.findByClerkId(clerkUser.id);

  // 2. If not found, try linking by email (seeded users have no clerkId)
  if (!dbUser && email) {
    dbUser = await userRepository.findByEmail(email);

    if (dbUser) {
      await userRepository.updateClerkId(dbUser.id, clerkUser.id);
    }
  }

  // 3. If still not found, return null — no auto-provisioning
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
