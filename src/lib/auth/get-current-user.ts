import { auth, currentUser } from "@clerk/nextjs/server";
import { cache } from "react";

import { userRoleRepository } from "@/db/repositories/auth/user-role.repository";
import { userRepository } from "@/db/repositories/user/user.repository";
import { logger } from "@/lib/logger";

import { isRole } from "./roles";
import type { CurrentUser } from "./types";

export const getCurrentUser = cache(async function getCurrentUser(): Promise<CurrentUser | null> {
  const { userId: clerkUserId } = await auth();

  if (!clerkUserId) {
    return null;
  }

  let dbUser: Awaited<ReturnType<typeof userRepository.findByClerkId>> | null = null;
  let email: string | null = null;

  try {
    dbUser = await userRepository.findByClerkId(clerkUserId);
    if (dbUser) {
      email = dbUser.email;
    } else {
      // First-time login / unlinked user: call currentUser() once to fetch full profile and email for linking/provisioning
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return null;
      }

      email = clerkUser.emailAddresses[0]?.emailAddress ?? null;
      const isEmailVerified =
        clerkUser.emailAddresses[0]?.verification?.status === "verified";

      if (email && isEmailVerified) {
        dbUser = await userRepository.findByEmail(email);
        if (dbUser) {
          await userRepository.updateClerkId(dbUser.id, clerkUser.id);
        }
      }

      if (!dbUser && email) {
        const fullName =
          clerkUser.firstName && clerkUser.lastName
            ? `${clerkUser.firstName} ${clerkUser.lastName}`
            : clerkUser.firstName ?? clerkUser.username ?? "Unknown";

        dbUser = await userRepository.create({
          clerkId: clerkUser.id,
          fullName,
          email,
          profileImageUrl: clerkUser.imageUrl,
        });
      }
    }
  } catch (err) {
    logger.error("[getCurrentUser] DB query failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  if (!dbUser) {
    return null;
  }

  // Disabling or deleting a user must take effect on the next request, even
  // while their Clerk session is still valid. This is the single enforcement
  // point: every route reaches the database user through this function.
  if (!dbUser.isActive || dbUser.deletedAt) {
    logger.warn("[getCurrentUser] inactive or deleted user denied", {
      userId: dbUser.id,
    });
    return null;
  }

  const [roleCodes, roleScopes] = await Promise.all([
    userRoleRepository.findRoleCodesByUserId(dbUser.id),
    userRoleRepository.findRoleScopesByUserId(dbUser.id),
  ]);
  const roles = Array.from(new Set(roleCodes.filter(isRole)));

  const currentUserValue: CurrentUser = {
    id: dbUser.id,
    clerkId: clerkUserId,
    email: email ?? dbUser.email,
    roles,
    roleScopes,
  };

  return currentUserValue;
});
