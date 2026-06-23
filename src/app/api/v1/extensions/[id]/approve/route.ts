import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import approveLeaveSchema from "@/dto/leave/approve-leave.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { approveExtension } from "@/services/leave/approve-extension.service";
import { rejectExtension } from "@/services/leave/reject-extension.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = approveLeaveSchema.parse(body);

    const { id: extensionId } = await routeContext.params;

    const result = dto.decision === LEAVE_APPROVAL_DECISION.REJECTED
      ? await rejectExtension(extensionId, dto, currentUser)
      : await approveExtension(extensionId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
