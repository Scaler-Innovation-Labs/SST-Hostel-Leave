import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getLateStayClaimEligibility } from "@/services/leave/recurring-authorization/claim-eligibility.service";

/**
 * GET /api/v1/late-stay/claim-eligibility
 * Returns the covering ACTIVE authorization for right now (or null) so the
 * student UI can render the "Claim tonight" affordance.
 */
export async function GET() {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [ROLES.STUDENT]);

		const eligibility = await getLateStayClaimEligibility(currentUser);

		return ApiResponse.success(eligibility);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}
