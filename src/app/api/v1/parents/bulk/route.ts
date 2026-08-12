import { bulkCreateParentsSchema } from "@/dto/parent/bulk-create-parents.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { bulkCreateParents } from "@/services/parent/bulk-create-parents.service";
import { parseCsv } from "@/utils/csv";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const contentType = request.headers.get("content-type") ?? "";
    let rows: unknown;

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      rows = parseCsv(await request.text());
    } else {
      rows = await request.json();
    }

    const dto = bulkCreateParentsSchema.parse(rows);

    const results = await bulkCreateParents(dto, currentUser.id);

    return ApiResponse.success({
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
