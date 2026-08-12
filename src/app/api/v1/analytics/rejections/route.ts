import { analyticsPeriodSchema } from "@/dto/analytics/analytics-period.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { getRejectionAnalytics } from "@/services/analytics/get-rejection-analytics.service";

export async function GET(request?: Request) {
  try {
    const currentUser = await requireAuth();

    let period: "7d" | "30d" | "90d" | "all" | undefined;
    if (request) {
      const url = new URL(request.url);
      const raw = url.searchParams.get("period");
      if (raw) {
        period = analyticsPeriodSchema.parse(raw);
      }
    }

    const result = await getRejectionAnalytics(currentUser, period);

    return ApiResponse.success(result);
  } catch (error) {
    logger.error("Rejection analytics error", { error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}