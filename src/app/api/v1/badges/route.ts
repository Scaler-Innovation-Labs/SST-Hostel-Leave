import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getNavBadges } from "@/services/shared/get-nav-badges.service";
import { logger } from "@/lib/logger";

/**
 * Nav badge counts for staff dashboards in one round trip.
 *
 * The sidebar previously fired three independent pollers (approvals,
 * extension approvals, overdue) on every authenticated navigation — three
 * cold-lambda opportunities per page view. This aggregates them into one.
 */
export async function GET() {
  const authStart = Date.now();
  try {
    const authTimer = Date.now();
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);
    const authDuration = Date.now() - authTimer;

    const serviceTimer = Date.now();
    const badges = await getNavBadges(currentUser);
    const serviceDuration = Date.now() - serviceTimer;
    const totalDuration = Date.now() - authStart;

    logger.info("badges GET", { authDuration, serviceDuration, totalDuration });

    return ApiResponse.success(badges);
  } catch (error) {
    logger.error("badges GET error", { totalDuration: Date.now() - authStart, error: error instanceof Error ? error.message : String(error) });
    return ApiResponse.fromError(error);
  }
}
