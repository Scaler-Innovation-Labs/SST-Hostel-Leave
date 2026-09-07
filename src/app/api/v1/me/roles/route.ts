import { cookies } from "next/headers";

import { ACTIVE_ROLE_COOKIE, ROLE_CONSOLES } from "@/constants/auth/role-consoles";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { resolveActiveRole } from "@/services/auth/active-role.service";

export async function GET() {
  try {
    const user = await requireAuth();

    const requested = (await cookies()).get(ACTIVE_ROLE_COOKIE)?.value ?? null;
    const activeRole = resolveActiveRole(user.roles, requested);

    return ApiResponse.success({
      roles: user.roles.map((role) => ROLE_CONSOLES[role]),
      activeRole,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
