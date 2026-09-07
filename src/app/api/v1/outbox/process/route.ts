import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limiter";
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

    // Manual worker trigger fans out provider calls: throttle per admin.
    // (The always-on worker host drains the outbox on its own interval; this
    // endpoint is just an on-demand nudge for admins/testing.)
    await rateLimit(`outbox-process:${currentUser.id}`, 10, 60_000);

    const result = await processPendingEvents();

    logger.info("Outbox worker completed", { triggeredBy: currentUser.id, processed: result.processed, failed: result.failed, skipped: result.skipped });

    return ApiResponse.success({
      processed: result.processed,
      failed: result.failed,
      skipped: result.skipped,
    });
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
