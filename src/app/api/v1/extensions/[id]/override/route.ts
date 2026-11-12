import { superadminOverrideSchema } from "@/dto/leave/superadmin-override.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { superadminOverrideExtension } from "@/services/leave/superadmin-override-extension.service";

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;
    const body = await readBoundedJson(request);
    const dto = superadminOverrideSchema.parse(body);

    const result = await superadminOverrideExtension(
      id,
      dto.mode,
      currentUser,
      dto.comments
    );

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
