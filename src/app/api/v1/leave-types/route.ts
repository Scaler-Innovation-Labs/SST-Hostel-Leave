import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listLeaveTypes } from "@/services/leave/list-leave-types.service";

export async function GET() {
  try {
    // Any real role may read reference data — but a bare requireAuth() also
    // admits auto-provisioned zero-role identities, so enumerate the roles.
    requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.GUARD,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const result = await listLeaveTypes();

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

