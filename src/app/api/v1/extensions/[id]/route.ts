import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getExtension } from "@/services/leave/get-extension.service";

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;
    const result = await getExtension(id, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
