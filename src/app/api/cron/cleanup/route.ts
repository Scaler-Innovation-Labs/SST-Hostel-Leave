import { ApiResponse } from "@/lib/api/response";
import { checkCronAuth } from "@/lib/auth/cron-auth";
import { logger } from "@/lib/logger";
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

    // Jobs isolate per-item failures, so a 200 with the failures inline is how
    // a pass that retired nothing went unnoticed. Report them as a failed run
    // (the detailed errors also go to the log).
    const failures = results.flatMap((result) => {
      if (result.success === false) {
        return [String(result.error ?? `${String(result.job)} threw`)];
      }

      const errors = Array.isArray(result.errors) ? result.errors : [];

      return errors.map(String);
    });

    if (failures.length > 0) {
      logger.error("Retention pass reported failures", { errors: failures });

      return ApiResponse.error(
        "CRON_JOB_FAILED",
        `cleanup failed for ${failures.length} item(s): ${failures
          .slice(0, 3)
          .join("; ")}`,
        500
      );
    }

    return ApiResponse.success({ results });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
