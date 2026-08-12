import updateUserSchema from "@/dto/user/update-user.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { deactivateUser } from "@/services/user/deactivate-user.service";
import { getUser } from "@/services/user/get-user.service";
import { updateUser } from "@/services/user/update-user.service";

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const body = await request.json();
    const dto = updateUserSchema.parse(body);

    const result = await updateUser(id, dto, currentUser.id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const result = await deactivateUser(id, currentUser.id);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

