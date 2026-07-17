import { ApiResponse } from "@/lib/api/response";
import { runRetryOutboxJob } from "@/services/cron/retry-outbox.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const result = await runRetryOutboxJob();

    return ApiResponse.success({ result });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
