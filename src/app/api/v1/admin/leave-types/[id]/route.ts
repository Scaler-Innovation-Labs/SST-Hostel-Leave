import saveLeaveTypeSchema from "@/dto/leave/save-leave-type.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { updateLeaveType } from "@/services/leave/update-leave-type.service";
import { deleteLeaveType } from "@/services/leave/delete-leave-type.service";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;

    const dto = saveLeaveTypeSchema.partial().parse(await request.json());

    const leaveType = await updateLeaveType(id, dto);

    return ApiResponse.success(leaveType);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;

    await deleteLeaveType(id);

    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
