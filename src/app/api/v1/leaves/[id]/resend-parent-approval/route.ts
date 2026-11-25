import { resendParentApprovalSchema } from "@/dto/parent/resend-parent-approval.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { resendParentApproval } from "@/services/parent/resend-parent-approval.service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);
    const { id } = await params;

    const rawBody = await request.text();
    const dto = rawBody.trim()
      ? resendParentApprovalSchema.parse(JSON.parse(rawBody))
      : {};

    const result = dto.parentId !== undefined
      ? await resendParentApproval(id, currentUser, dto.parentId)
      : await resendParentApproval(id, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
