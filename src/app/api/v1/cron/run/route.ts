import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { runAllCronJobs } from "@/services/cron";

export async function POST() {
  try {
    requireAnyRole(await requireAuth(), [ROLES.SUPER_ADMIN]);

    const summary = await runAllCronJobs();

    return ApiResponse.success(summary, summary.hasErrors ? 207 : 200);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
