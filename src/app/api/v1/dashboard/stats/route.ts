import { dashboardStatsQuerySchema } from "@/dto/dashboard/dashboard-stats-query.dto";
import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { getDashboardStats } from "@/services/dashboard/get-dashboard-stats.service";

export async function GET(request?: Request) {
  const start = Date.now();
  try {
    const authTimer = Date.now();
    const currentUser = await requireAuth();
    const authDuration = Date.now() - authTimer;

    const query = dashboardStatsQuerySchema.parse(
      Object.fromEntries(request ? new URL(request.url).searchParams : []),
    );

    const serviceTimer = Date.now();
    const result = await getDashboardStats(currentUser, query.status);
    const serviceDuration = Date.now() - serviceTimer;

    logger.info("dashboard/stats GET", { authDuration, serviceDuration, totalDuration: Date.now() - start });

    return ApiResponse.success(result);
  } catch (error) {
    logger.error("Dashboard stats error", { totalDuration: Date.now() - start, error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}
