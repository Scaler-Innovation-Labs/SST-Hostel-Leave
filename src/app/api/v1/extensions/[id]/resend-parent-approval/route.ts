import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { resendExtensionParentApproval } from "@/services/parent/resend-parent-approval.service";

export async function POST(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;

    await rateLimit(`resend-parent-ext:${id}`, 5, 60_000);

    const result = await resendExtensionParentApproval(id, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
