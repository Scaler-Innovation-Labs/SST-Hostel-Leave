import { ListParentsSchema } from "@/dto/parent/list-parents.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { parentManagementService } from "@/services/parent/parent-management.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const url = new URL(request.url);
    const { page, limit } = ListParentsSchema.parse(Object.fromEntries(url.searchParams));
    const search = url.searchParams.get("search") ?? undefined;
    const studentId = url.searchParams.get("studentId") ?? undefined;

    const result = await parentManagementService.list({ search, studentId, page, limit });

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const body = await request.json();
    const { createParentSchema } = await import("@/dto/admin/create-parent.dto");
    const dto = createParentSchema.parse(body);

    const result = await parentManagementService.create(dto);

    return ApiResponse.created(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

