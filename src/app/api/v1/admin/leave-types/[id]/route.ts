import { createLeaveTypeSchema } from "@/dto/leave/save-leave-type.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getLeaveTypeById } from "@/services/leave/get-leave-type.service";
import { updateLeaveType } from "@/services/leave/update-leave-type.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const leaveType = await getLeaveTypeById(id);

    return ApiResponse.success(leaveType);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const dto = createLeaveTypeSchema.parse(await request.json());

    const leaveType = await updateLeaveType(id, dto);

    return ApiResponse.success(leaveType);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
