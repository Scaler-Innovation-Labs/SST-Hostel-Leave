import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { userRepository } from "@/db/repositories/user/user.repository";
import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";

export default async function RedirectPage() {
  const { sessionId, userId } = await auth();

  if (!userId || !sessionId) {
    redirect("/login");
  }

  const user = await getCurrentUser();

  if (!user) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
    redirect("/login?error=unauthorized");
  }

  if (user.roles.length === 0) {
    redirect("/unauthorized");
  }

  // Record login timestamp at the actual post-login dispatch boundary
  try {
    await userRepository.touchLastLogin(user.id);
  } catch (err) {
    logger.error("[RedirectPage] touchLastLogin failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const role = user.roles[0]!;

  switch (role) {
    case ROLES.GUARD:
      redirect("/guard/scanner");

    case ROLES.STUDENT:
      redirect("/student/dashboard");

    case ROLES.ADMIN:
      redirect("/admin/dashboard");

    case ROLES.POC:
      redirect("/poc/dashboard");

    case ROLES.SUPER_ADMIN:
      redirect("/super-admin/dashboard");

    default:
      redirect("/unauthorized");
  }
}
