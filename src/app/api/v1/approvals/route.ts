import listApprovalsSchema from "@/dto/approval/list-approvals.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listApprovals } from "@/services/approval/list-approvals.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [
      ROLES.STUDENT,
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const url = new URL(request.url);
    const query = listApprovalsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listApprovals(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

export const runtime = "edge";
