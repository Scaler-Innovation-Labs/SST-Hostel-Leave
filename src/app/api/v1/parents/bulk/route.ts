import { bulkCreateParentsSchema } from "@/dto/parent/bulk-create-parents.dto";
import { readBoundedBodyText } from "@/lib/api/bulk-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { bulkCreateParents } from "@/services/parent/bulk-create-parents.service";
import { parseCsv } from "@/utils/csv";

export async function POST(request: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    // 2000-row DB fan-out per call: throttle per admin.
    await rateLimit(`bulk:${currentUser.id}`, 10, 3_600_000);

    const contentType = request.headers.get("content-type") ?? "";
    let rows: unknown;

    if (contentType.includes("text/csv") || contentType.includes("application/csv")) {
      rows = parseCsv(await readBoundedBodyText(request));
    } else {
      rows = JSON.parse(await readBoundedBodyText(request));
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
