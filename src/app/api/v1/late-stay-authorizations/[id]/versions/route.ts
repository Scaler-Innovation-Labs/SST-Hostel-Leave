import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { getLateStayAuthorizationVersions } from "@/services/leave/recurring-authorization/get-authorization-versions.service";

/** Version history for an authorization lineage (V1, V2, …). */
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [
			ROLES.STUDENT,
			ROLES.POC,
			ROLES.ADMIN,
			ROLES.SUPER_ADMIN,
		]);

		const { id } = await params;

		const versions = await getLateStayAuthorizationVersions(id, currentUser);

		return ApiResponse.success({ versions });
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}
