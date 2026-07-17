import { runCleanupOtpJob } from "@/services/cron/cleanup-otp.job";
import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const otpResult = await runCleanupOtpJob();
    const qrResult = await runCleanupQrJob();

    return Response.json({
      success: true,
      results: [otpResult, qrResult],
    }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ success: false, error: message }, { status: 500 });
  }
}
