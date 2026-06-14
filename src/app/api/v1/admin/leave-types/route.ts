import saveLeaveTypeSchema from "@/dto/leave/save-leave-type.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listLeaveTypesAdmin } from "@/services/leave/list-leave-types-admin.service";
import { createLeaveType } from "@/services/leave/create-leave-type.service";

export async function GET() {
  try {
    requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const leaveTypes = await listLeaveTypesAdmin();

    return ApiResponse.success(leaveTypes);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const dto = saveLeaveTypeSchema.parse(await request.json());

    const leaveType = await createLeaveType(dto);

    return ApiResponse.created(leaveType);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
