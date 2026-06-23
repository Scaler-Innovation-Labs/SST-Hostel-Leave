import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listDepartments } from "@/services/academics/list-departments.service";

export async function GET() {
  try {
    await requireAnyRole(await requireAuth(), [
      ROLES.SUPER_ADMIN,
      ROLES.ADMIN,
    ]);

    const rows = await listDepartments();

    return ApiResponse.success(rows);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

