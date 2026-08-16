import { analyticsPeriodSchema } from "@/dto/analytics/analytics-period.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { getMovementAnalytics } from "@/services/analytics/get-movement-analytics.service";

export async function GET(request?: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    let period: "7d" | "30d" | "90d" | "all" | undefined;
    if (request) {
      const url = new URL(request.url);
      const raw = url.searchParams.get("period");
      if (raw) {
        period = analyticsPeriodSchema.parse(raw);
      }
    }

    const result = await getMovementAnalytics(currentUser, period);

    return ApiResponse.success(result);
  } catch (error) {
    logger.error("Movement analytics error", { error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}