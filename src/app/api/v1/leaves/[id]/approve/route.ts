import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import approveLeaveSchema from "@/dto/leave/approve-leave.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { approveLeave } from "@/services/leave/approve-leave.service";
import { rejectLeave } from "@/services/leave/reject-leave.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = approveLeaveSchema.parse(body);

    const { id: leaveId } = await routeContext.params;

    const result = dto.decision === LEAVE_APPROVAL_DECISION.REJECTED
      ? await rejectLeave(leaveId, dto, currentUser)
      : await approveLeave(leaveId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    console.error("[approve-leave] Error:", error);
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
