import approveLeaveSchema from "@/dto/leave/approve-leave.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { approveLeave } from "@/services/leave/approve-leave.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const body = await request.json();
    const dto = approveLeaveSchema.parse(body);

    const result = await approveLeave(id, dto, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
