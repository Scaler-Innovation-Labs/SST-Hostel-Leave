import listLeaveExtensionsSchema from "@/dto/extension/list-leave-extensions.dto";
import createExtensionSchema from "@/dto/leave/create-extension.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createExtension } from "@/services/leave/create-extension.service";
import { listLeaveExtensions } from "@/services/leave/list-leave-extensions.service";

export async function GET(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    const { id } = await routeContext.params;
    const url = new URL(request.url);
    const query = listLeaveExtensionsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listLeaveExtensions(id, query, currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);
    const { id } = await routeContext.params;
    const body = await request.json();
    const dto = createExtensionSchema.parse(body);
    const result = await createExtension(id, dto, currentUser);
    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
