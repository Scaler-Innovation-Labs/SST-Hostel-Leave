import { ApiResponse } from "@/lib/api/response";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { runAuditRetentionJob } from "@/services/cron/audit-retention.job";
import { runDocumentRetentionJob } from "@/services/cron/cleanup-documents.job";
import { runCleanupQrJob } from "@/services/cron/cleanup-qr.job";
import { runPurgeOutboxJob } from "@/services/cron/purge-outbox.job";

export async function GET(request: Request) {
  try {
    const unauthorized = checkCronAuth(request);
    if (unauthorized) return unauthorized;

    // Per-job isolation: one retention job throwing must not skip the
    // rest. Failures are reported inline, never thrown.
    const results: Array<Record<string, unknown>> = [];
    const jobs: Array<[string, () => Promise<unknown>]> = [
      ["cleanup-qr", runCleanupQrJob],
      ["document-retention", runDocumentRetentionJob],
      ["audit-retention", runAuditRetentionJob],
      // Retention family: PROCESSED outbox payloads (which may carry bearer
      // parent approval links) are purged past the retention window. Audit
      // history is independent of outbox retention.
      ["purge-outbox", runPurgeOutboxJob],
    ];

    for (const [name, run] of jobs) {
      try {
        results.push((await run()) as Record<string, unknown>);
      } catch (error) {
        results.push({
          job: name,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return ApiResponse.success({ results });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
