import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { getDashboardStats } from "@/services/dashboard/get-dashboard-stats.service";

export async function GET() {
  try {
    const currentUser = await requireAuth();

    const result = await getDashboardStats(currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    logger.error("Dashboard stats error", { error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}

