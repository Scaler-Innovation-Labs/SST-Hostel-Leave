import {
	authorizeLateStaySchema,
	revokeLateStaySchema,
} from "@/dto/leave/late-stay-authorization.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { authorizeLateStay } from "@/services/leave/recurring-authorization/approve-authorization.service";
import { revokeLateStayAuthorization } from "@/services/leave/recurring-authorization/revoke-authorization.service";

/**
 * Step-wise decision endpoint for a pending authorization. The service
 * derives the current step (PENDING_POC / PENDING_ADMIN) from status and
 * enforces role hierarchy; the caller never passes a step.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [
			ROLES.POC,
			ROLES.ADMIN,
			ROLES.SUPER_ADMIN,
		]);

		await rateLimit(`late-stay-auth:${currentUser.id}`, 60, 60_000);

		const { id } = await params;
		const body = await readBoundedJson(request);
		const dto = authorizeLateStaySchema.parse(body);

		const result = await authorizeLateStay(
			id,
			dto.decision,
			dto.comments,
			currentUser
		);

		return ApiResponse.success(result);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}

/** Revocation: ACTIVE → REVOKED with a mandatory reason. */
export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [
			ROLES.POC,
			ROLES.ADMIN,
			ROLES.SUPER_ADMIN,
		]);

		const { id } = await params;
		const body = await readBoundedJson(request);
		const dto = revokeLateStaySchema.parse(body);

		const result = await revokeLateStayAuthorization(id, dto.reason, currentUser);

		return ApiResponse.success(result);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}
