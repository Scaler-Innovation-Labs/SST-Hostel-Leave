import cancelLeaveSchema from "@/dto/leave/cancel-leave.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { cancelLeave } from "@/services/leave/cancel-leave.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireRole(await requireAuth(), ROLES.STUDENT);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const dto = cancelLeaveSchema.parse(body);

    const { id: leaveId } = await routeContext.params;

    const result = await cancelLeave(leaveId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
