import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { getExtension } from "@/services/extension/get-extension.service";

export async function GET(
  _request: Request,
  routeContext: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await routeContext.params;
    const result = await getExtension(id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
