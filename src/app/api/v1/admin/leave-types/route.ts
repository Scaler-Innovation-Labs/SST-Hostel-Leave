import { createLeaveTypeSchema } from "@/dto/leave/save-leave-type.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createLeaveType } from "@/services/leave/create-leave-type.service";
import { listLeaveTypesAdmin } from "@/services/leave/list-leave-types-admin.service";

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

    const dto = createLeaveTypeSchema.parse(await request.json());

    const leaveType = await createLeaveType(dto);

    return ApiResponse.created(leaveType);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

