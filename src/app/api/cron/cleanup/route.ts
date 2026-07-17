import { ApiResponse } from "@/lib/api/response";
import { runCleanupOtpJob } from "@/services/cron/cleanup-otp.job";
import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const otpResult = await runCleanupOtpJob();
    const qrResult = await runCleanupQrJob();

    return ApiResponse.success({ results: [otpResult, qrResult] });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
