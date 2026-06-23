import { auth, clerkClient } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/get-current-user";
import { ROLES } from "@/lib/auth/roles";

export default async function RedirectPage() {
  const user = await getCurrentUser();
  const { sessionId, userId } = await auth();

  if (!user && userId && sessionId) {
    const client = await clerkClient();
    await client.sessions.revokeSession(sessionId);
    redirect("/login?error=unauthorized");
  }

  if (!user) {
    redirect("/login");
  }

  if (user.roles.length === 0) {
    redirect("/unauthorized");
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
