import { ApiResponse } from "@/lib/api/response";
import { requireAuth } from "@/lib/auth/require-auth";
import { getDashboardStats } from "@/services/dashboard/get-dashboard-stats.service";

export async function GET() {
  try {
    const currentUser = await requireAuth();

    const result = await getDashboardStats(currentUser);

    return ApiResponse.success(result);
  } catch (error) {
    console.error("[DASHBOARD_STATS_GET]", error);
    return ApiResponse.fromError(error);
  }
}

