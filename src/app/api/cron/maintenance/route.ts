import { ApiResponse } from "@/lib/api/response";
import { runExpireLeavesJob } from "@/services/cron/expire-leaves.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    // Single lifecycle pass (contract §3): auto-complete non-QR leaves (T16),
    // expire never-scanned QR leaves (T6), then atomically mark open sessions
    // overdue (T7). The old state-only mark-overdue job is gone — one engine.
    const result = await runExpireLeavesJob();

    return ApiResponse.success({ results: [result] });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
