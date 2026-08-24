import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getNavBadges } from "@/services/shared/get-nav-badges.service";

/**
 * Nav badge counts for staff dashboards in one round trip.
 *
 * The sidebar previously fired three independent pollers (approvals,
 * extension approvals, overdue) on every authenticated navigation — three
 * cold-lambda opportunities per page view. This aggregates them into one.
 */
export async function GET() {
  try {
    const currentUser = requireAnyRole(await requireAuth(), [
      ROLES.POC,
      ROLES.ADMIN,
      ROLES.SUPER_ADMIN,
    ]);

    const badges = await getNavBadges(currentUser);

    return ApiResponse.success(badges);
  } catch (error) {
    return ApiResponse.fromError(error);
  }
}
