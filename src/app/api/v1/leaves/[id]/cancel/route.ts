import cancelLeaveSchema from "@/dto/leave/cancel-leave.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { cancelLeave } from "@/services/leave/cancel-leave.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireRole(await requireAuth(), ROLES.STUDENT);

    await rateLimit(`cancel-leave:${currentUser.id}`, 30, 60_000);

    const body = await readBoundedJson(request, { allowEmpty: true });
    const dto = cancelLeaveSchema.parse(body);

    const { id: leaveId } = await routeContext.params;

    const result = await cancelLeave(leaveId, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
