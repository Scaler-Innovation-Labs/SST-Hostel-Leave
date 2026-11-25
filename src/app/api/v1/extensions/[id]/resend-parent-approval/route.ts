import { resendParentApprovalSchema } from "@/dto/parent/resend-parent-approval.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { resendExtensionParentApproval } from "@/services/parent/resend-parent-approval.service";

export async function POST(
  request: Request,
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

    const rawBody = await request.text();
    const dto = rawBody.trim()
      ? resendParentApprovalSchema.parse(JSON.parse(rawBody))
      : {};

    const result = dto.parentId !== undefined
      ? await resendExtensionParentApproval(id, currentUser, dto.parentId)
      : await resendExtensionParentApproval(id, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
