import { ApiResponse } from "@/lib/api/response";
import { runExpireLeavesJob } from "@/services/cron/expire-leaves.job";
import { runMarkOverdueJob } from "@/services/cron/mark-overdue.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const expireResult = await runExpireLeavesJob();
    const overdueResult = await runMarkOverdueJob();

    return ApiResponse.success({ results: [expireResult, overdueResult] });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
