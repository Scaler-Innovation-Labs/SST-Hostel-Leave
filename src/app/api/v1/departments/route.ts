import { saveDepartmentSchema } from "@/dto/department/save-department.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createDepartment } from "@/services/academics/create-department.service";
import { listDepartments } from "@/services/academics/list-departments.service";

export async function GET() {
  try {
    await requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const rows = await listDepartments();
    return ApiResponse.success(rows);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    requireAnyRole(user, [ROLES.SUPER_ADMIN]);
    const dto = saveDepartmentSchema.parse(await request.json());
    const department = await createDepartment(dto, user);
    return ApiResponse.created(department);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
