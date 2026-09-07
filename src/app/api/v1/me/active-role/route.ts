import { cookies } from "next/headers";

import { ACTIVE_ROLE_COOKIE, ROLE_CONSOLES } from "@/constants/auth/role-consoles";
import setActiveRoleSchema from "@/dto/auth/set-active-role.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { validateRoleSwitch } from "@/services/auth/active-role.service";

export async function POST(request: Request) {
  try {
    const user = await requireAuth();

    const body = await request.json();
    const dto = setActiveRoleSchema.parse(body);

    const activeRole = validateRoleSwitch(user.roles, dto.role);

    (await cookies()).set(ACTIVE_ROLE_COOKIE, activeRole, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });

    return ApiResponse.success({
      activeRole,
      dashboardHref: ROLE_CONSOLES[activeRole].dashboardHref,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
