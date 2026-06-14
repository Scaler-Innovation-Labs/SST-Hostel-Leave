import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getConfigStatus } from "@/services/admin/config-status.service";

export async function GET() {
  try {
    const currentUser = await requireAuth();
    requireAnyRole(currentUser, [ROLES.SUPER_ADMIN]);

    const status = getConfigStatus();

    return ApiResponse.success(status);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
