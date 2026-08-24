import { ApiResponse } from "@/lib/api/response";
import { runAuditRetentionJob } from "@/services/cron/audit-retention.job";
import { runDocumentRetentionJob } from "@/services/cron/cleanup-documents.job";
import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
    }

    const qrResult = await runCleanupQrJob();
    const documentResult = await runDocumentRetentionJob();
    const auditResult = await runAuditRetentionJob();

    return ApiResponse.success({
      results: [qrResult, documentResult, auditResult],
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
