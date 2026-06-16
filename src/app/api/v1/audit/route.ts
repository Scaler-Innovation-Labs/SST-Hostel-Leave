import listAuditSchema from "@/dto/audit/list-audit.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { auditService } from "@/services/audit/audit.service";

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(request.url);
    const query = listAuditSchema.parse(Object.fromEntries(url.searchParams));

    const result = await auditService.listAuditLogs(query, user);
    return ApiResponse.success(result);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
