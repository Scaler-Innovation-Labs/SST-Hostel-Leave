import createExtensionSchema from "@/dto/leave/create-extension.dto";
import listLeaveExtensionsSchema from "@/dto/extension/list-leave-extensions.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { createExtension } from "@/services/leave/create-extension.service";
import { listLeaveExtensions } from "@/services/extension/list-leave-extensions.service";

export async function GET(
  request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await routeContext.params;
    const url = new URL(request.url);
    const query = listLeaveExtensionsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listLeaveExtensions(id, query);

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
    const currentUser = await requireAuth();
    const { id } = await routeContext.params;
    const body = await request.json();
    const dto = createExtensionSchema.parse(body);
    const result = await createExtension(id, dto, currentUser);
    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
