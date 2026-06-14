import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { expireSingleLeave } from "@/services/leave/expire-leave.service";

export async function POST(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const { id: leaveId } = await routeContext.params;

    const result = await expireSingleLeave(leaveId, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
