import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getUser } from "@/services/user/get-user.service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const result = await getUser(id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

