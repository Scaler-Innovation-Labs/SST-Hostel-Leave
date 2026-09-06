import { ApiResponse } from "@/lib/api/response";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { runRetryOutboxJob } from "@/services/cron/retry-outbox.job";

export async function GET(request: Request) {
  try {
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    // Resets failed events (within attempt budget) and processes pending
    // events in a single run — the separate /api/cron/retry schedule is gone.
    const result = await runRetryOutboxJob();

    return ApiResponse.success({ result });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
