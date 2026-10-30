import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import approveLeaveSchema from "@/dto/leave/approve-leave.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { approveLeave } from "@/services/leave/approve-leave.service";
import { rejectLeave } from "@/services/leave/reject-leave.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    await rateLimit(`approve:${currentUser.id}`, 60, 60_000);

    const { id } = await params;
    const body = await readBoundedJson(request);
    const dto = approveLeaveSchema.parse(body);

    const result = dto.decision === LEAVE_APPROVAL_DECISION.REJECTED
      ? await rejectLeave(id, dto, currentUser)
      : await approveLeave(id, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
