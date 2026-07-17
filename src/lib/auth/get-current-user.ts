import { currentUser } from "@clerk/nextjs/server";

import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository } from "@/db/repositories/user/user.repository";

import { isRole } from "./roles";
import type { CurrentUser } from "./types";

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const clerkUser = await currentUser();

  if (!clerkUser) {
    return null;
  }

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? null;

  let dbUser: Awaited<ReturnType<typeof userRepository.findByClerkId>> | null = null;

  try {
    dbUser = await userRepository.findByClerkId(clerkUser.id);

    if (!dbUser && email) {
      dbUser = await userRepository.findByEmail(email);
      if (dbUser) {
        await userRepository.updateClerkId(dbUser.id, clerkUser.id);
      }
    }

    if (!dbUser && email) {
      const fullName = clerkUser.firstName && clerkUser.lastName
        ? `${clerkUser.firstName} ${clerkUser.lastName}`
        : clerkUser.firstName ?? clerkUser.username ?? "Unknown";

      dbUser = await userRepository.create({
        clerkId: clerkUser.id,
        fullName,
        email,
        profileImageUrl: clerkUser.imageUrl,
      });
    }
  } catch (err) {
    console.error("[getCurrentUser] DB query failed:", err instanceof Error ? err.message : String(err));
    return null;
  }

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
