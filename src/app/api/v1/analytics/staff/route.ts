import { type AnalyticsPeriod,analyticsPeriodSchema } from "@/dto/analytics/analytics-period.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { getStaffAnalytics } from "@/services/analytics/get-staff-analytics.service";

export async function GET(request?: Request) {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.ADMIN,
      ROLES.POC,
      ROLES.SUPER_ADMIN,
    ]);

    let period: AnalyticsPeriod | undefined;
    let startDate: string | undefined;
    let endDate: string | undefined;
    if (request) {
      const url = new URL(request.url);
      const raw = url.searchParams.get("period");
      if (raw) {
        period = analyticsPeriodSchema.parse(raw);
      }
      startDate = url.searchParams.get("startDate") ?? url.searchParams.get("from") ?? undefined;
      endDate = url.searchParams.get("endDate") ?? url.searchParams.get("to") ?? undefined;
    }

    const result = (startDate !== undefined || endDate !== undefined)
      ? await getStaffAnalytics(currentUser, period, startDate, endDate)
      : await getStaffAnalytics(currentUser, period);

    return ApiResponse.success(result);
  } catch (error) {
    logger.error("Staff analytics error", { error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}
