import { ApiResponse } from "@/lib/api/response";
import { processPendingEvents } from "@/services/outbox/outbox-worker.service";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const result = await processPendingEvents();

    return ApiResponse.success({ result });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
