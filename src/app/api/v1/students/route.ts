import listStudentsSchema from "@/dto/student/list-students.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listStudents } from "@/services/student/list-students.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const query = listStudentsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listStudents(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

