import { ApiResponse } from "@/lib/api/response";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
import { runExpireLeavesJob } from "@/services/cron/expire-leaves.job";

export async function GET(request: Request) {
  try {
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    // Single lifecycle pass (contract §3): auto-complete non-QR leaves (T16),
    // expire never-scanned QR leaves (T6), then atomically mark open sessions
    // overdue (T7). The old state-only mark-overdue job is gone — one engine.
    const result = await runExpireLeavesJob();

    // Per-item failures are isolated inside the pass, so a green 200 with the
    // errors buried in the body is how stuck leaves went unnoticed for days.
    // Fail the run instead: the scheduler flags it and the log carries the rest.
    const errors = [
      ...result.completed.errors,
      ...result.expired.errors,
      ...result.overdue.errors,
    ];

    if (errors.length > 0) {
      logger.error("Leave lifecycle pass reported failures", {
        job: result.job,
        errors,
      });

      return ApiResponse.error(
        "CRON_JOB_FAILED",
        `expire-leaves failed for ${errors.length} item(s): ${errors
          .slice(0, 3)
          .join("; ")}`,
        500
      );
    }

    return ApiResponse.success({ results: [result] });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
