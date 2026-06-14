import savePolicySchema from "@/dto/policy/save-policy.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { updatePolicy } from "@/services/policy/manage-policy.service";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const { id } = await params;
    const dto = savePolicySchema.parse(await request.json());
    return ApiResponse.success(await updatePolicy(id, dto, user.id));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
