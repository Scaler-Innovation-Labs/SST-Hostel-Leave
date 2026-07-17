import { saveAcademicGroupSchema } from "@/dto/academic-group/save-academic-group.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createAcademicGroup } from "@/services/academics/create-academic-group.service";
import { listAcademicGroups } from "@/services/academics/list-academic-groups.service";

export async function GET() {
  try {
    await requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN, ROLES.ADMIN]);
    const rows = await listAcademicGroups();
    return ApiResponse.success(rows);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireAuth();
    requireAnyRole(user, [ROLES.SUPER_ADMIN]);
    const dto = saveAcademicGroupSchema.parse(await request.json());
    const group = await createAcademicGroup(dto, user);
    return ApiResponse.created(group);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
