import { saveAcademicGroupSchema } from "@/dto/academic-group/save-academic-group.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { deleteAcademicGroup } from "@/services/academics/delete-academic-group.service";
import { getAcademicGroupById } from "@/services/academics/get-academic-group.service";
import { updateAcademicGroup } from "@/services/academics/update-academic-group.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const { id } = await params;
    const row = await getAcademicGroupById(id);
    if (!row) throw new NotFoundError("Academic group not found");
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
    const dto = saveAcademicGroupSchema.parse(await request.json());
    const row = await updateAcademicGroup(id, dto, user);
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
    await deleteAcademicGroup(id, user);
    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
