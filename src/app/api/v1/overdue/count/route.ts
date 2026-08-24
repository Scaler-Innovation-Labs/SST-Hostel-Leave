import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { countOverdueReturns } from "@/services/movement/count-overdue-returns.service";

/**
 * Lightweight count for the sidebar badge — avoids shipping the full
 * overdue list (200 rows × 18 columns) to clients that only display a
 * number. Mirrors GET /api/v1/overdue scope rules.
 */
export async function GET() {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const count = await countOverdueReturns(currentUser);

    return ApiResponse.success({ count });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
