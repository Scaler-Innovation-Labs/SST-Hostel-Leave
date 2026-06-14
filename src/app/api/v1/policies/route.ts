import savePolicySchema from "@/dto/policy/save-policy.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createPolicy, listPolicies } from "@/services/policy/manage-policy.service";

export async function GET() {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    return ApiResponse.success(await listPolicies());
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);
    const dto = savePolicySchema.parse(await request.json());
    return ApiResponse.created(await createPolicy(dto, user.id));
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
