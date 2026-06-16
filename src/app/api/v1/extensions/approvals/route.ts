import listExtensionApprovalsSchema from "@/dto/extension/list-extension-approvals.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { listExtensionApprovals } from "@/services/extension/list-extension-approvals.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN]);

    const url = new URL(request.url);
    const query = listExtensionApprovalsSchema.parse(Object.fromEntries(url.searchParams));

    const result = await listExtensionApprovals(query);

    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}

