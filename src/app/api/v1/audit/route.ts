import listAuditSchema from "@/dto/audit/list-audit.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { auditService } from "@/services/audit/audit.service";

export async function GET(request: Request) {
  try {
    requireAnyRole(await requireAuth(), [ROLES.ADMIN, ROLES.SUPER_ADMIN]);
    const url = new URL(request.url);
    const query = listAuditSchema.parse(Object.fromEntries(url.searchParams));
    const result = await auditService.findByEntity(query);
    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
