import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { processPendingEvents } from "@/services/outbox/outbox-worker.service";

/**
 * POST /api/v1/outbox/process
 *
 * Triggers the outbox worker to process pending events.
 * Can be called by:
 *  - A cron job (e.g. Vercel Cron, GitHub Actions)
 *  - An admin/super-admin manually for testing
 *
 * In production, set up a cron to call this endpoint every 1-5 minutes.
 */
export async function POST() {
  try {
    const currentUser = requireAnyRole(
      await requireAuth(),
      [ROLES.SUPER_ADMIN, ROLES.ADMIN],
    );

    const result = await processPendingEvents();

    console.info(
      `[OUTBOX] Worker completed triggered by ${currentUser.id}: ` +
      `${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`
    );

    return ApiResponse.success({
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
