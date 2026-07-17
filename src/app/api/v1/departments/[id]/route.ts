import { saveDepartmentSchema } from "@/dto/department/save-department.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { NotFoundError } from "@/lib/errors/not-found-error";
import { deleteDepartment } from "@/services/academics/delete-department.service";
import { getDepartmentById } from "@/services/academics/get-department.service";
import { updateDepartment } from "@/services/academics/update-department.service";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const { id } = await params;
    const row = await getDepartmentById(id);
    if (!row) throw new NotFoundError("Department not found");
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
    const dto = saveDepartmentSchema.parse(await request.json());
    const row = await updateDepartment(id, dto, user);
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
    await deleteDepartment(id, user);
    return ApiResponse.success({ deleted: true });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
