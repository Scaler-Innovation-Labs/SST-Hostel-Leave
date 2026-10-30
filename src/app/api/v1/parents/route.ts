import { ListParentsSchema } from "@/dto/parent/list-parents.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { parentManagementService } from "@/services/parent/parent-management.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const url = new URL(request.url);
    const { page, limit, search, studentId } = ListParentsSchema.parse(
      Object.fromEntries(url.searchParams)
    );

    const result = await parentManagementService.list({ search, studentId, page, limit });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const body = await readBoundedJson(request);
    const { createParentSchema } = await import("@/dto/admin/create-parent.dto");
    const dto = createParentSchema.parse(body);

    const result = await parentManagementService.create(dto, currentUser.id);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

