import updateParentSchema from "@/dto/admin/update-parent.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { parentManagementService } from "@/services/admin/parent-management.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    return ApiResponse.success(await parentManagementService.getById(id));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = updateParentSchema.parse(await request.json());
    return ApiResponse.success(await parentManagementService.update(id, dto));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    await parentManagementService.delete(id);
    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
