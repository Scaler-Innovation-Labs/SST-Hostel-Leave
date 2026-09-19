import {
	createLateStayAuthorizationSchema,
	listLateStayAuthorizationsSchema,
} from "@/dto/leave/late-stay-authorization.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { createLateStayAuthorization } from "@/services/leave/recurring-authorization/create-authorization.service";
import { listLateStayAuthorizations } from "@/services/leave/recurring-authorization/list-authorizations.service";

export async function GET(request: Request) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [
			ROLES.STUDENT,
			ROLES.POC,
			ROLES.ADMIN,
			ROLES.SUPER_ADMIN,
		]);

		const url = new URL(request.url);
		const query = listLateStayAuthorizationsSchema.parse(
			Object.fromEntries(url.searchParams)
		);

		const result = await listLateStayAuthorizations(query, currentUser);

		return ApiResponse.success(result);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}

export async function POST(request: Request) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [ROLES.STUDENT]);

		const body = await readBoundedJson(request);
		const dto = createLateStayAuthorizationSchema.parse(body);

		const result = await createLateStayAuthorization(dto, currentUser);

		return ApiResponse.created(result);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}
