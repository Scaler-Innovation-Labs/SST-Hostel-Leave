import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { parentManagementService } from "@/services/admin/parent-management.service";

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await routeContext.params;
    const result = await parentManagementService.getById(id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function PUT(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await routeContext.params;
    const body = await request.json();
    const { updateParentSchema } = await import("@/dto/admin/update-parent.dto");
    const dto = updateParentSchema.parse(body);

    const result = await parentManagementService.update(id, dto);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
