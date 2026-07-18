import { superadminOverrideSchema } from "@/dto/leave/superadmin-override.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { superadminOverrideLeave } from "@/services/leave/superadmin-override.service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const { id } = await params;
    const body = await request.json();
    const dto = superadminOverrideSchema.parse(body);

    const result = await superadminOverrideLeave(id, dto.mode, currentUser.id, dto.comments);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
