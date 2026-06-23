import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { expireSingleLeave } from "@/services/leave/expire-leave.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const { id } = await params;

    const result = await expireSingleLeave(id, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
