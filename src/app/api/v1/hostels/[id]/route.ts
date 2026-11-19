import { saveHostelSchema } from "@/dto/hostel/save-hostel.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { AuthorizationError, NotFoundError } from "@/lib/errors";
import { deleteHostel } from "@/services/hostel/delete-hostel.service";
import { getHostelById } from "@/services/hostel/get-hostel.service";
import { updateHostel } from "@/services/hostel/update-hostel.service";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const { id } = await params;
    if (isStaffScopeRestricted(currentUser)) {
      const allowedHostels = getScopedHostelIds(currentUser);
      if (!allowedHostels.includes(id)) {
        throw new AuthorizationError("You do not have access to this hostel");
      }
    }
    const row = await getHostelById(id);
    if (!row) throw new NotFoundError("Hostel not found");
    return ApiResponse.success(row);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    requireAnyRole(user, [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = saveHostelSchema.parse(await readBoundedJson(request));
    const row = await updateHostel(id, dto, user);
    return ApiResponse.success(row);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth();
    requireAnyRole(user, [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    await deleteHostel(id, user);
    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
