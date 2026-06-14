import completeLeaveSchema from "@/dto/leave/complete-leave.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { completeLeave } from "@/services/leave/complete-leave.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const dto = completeLeaveSchema.parse(body);

    const { id: leaveId } = await routeContext.params;

    const result = await completeLeave(leaveId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
