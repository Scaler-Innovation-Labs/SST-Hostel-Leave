import { ApiResponse } from "@/lib/api/response";
import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const qrResult = await runCleanupQrJob();

    return ApiResponse.success({ results: [qrResult] });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
