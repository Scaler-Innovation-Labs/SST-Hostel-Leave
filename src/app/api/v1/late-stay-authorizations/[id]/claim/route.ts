import { claimLateStaySchema } from "@/dto/leave/late-stay-authorization.dto";
import { readBoundedJson } from "@/lib/api/request-body";
import { ApiResponse } from "@/lib/api/response";
import { requireAnyRole } from "@/lib/auth/authorization";
import { requireAuth } from "@/lib/auth/require-auth";
import { ROLES } from "@/lib/auth/roles";
import { rateLimit } from "@/lib/rate-limiter";
import { claimLateStayOccurrence } from "@/services/leave/recurring-authorization/claim-occurrence.service";

/**
 * Layer 2 entry point: claim an occurrence ("I'm staying late tonight").
 * Idempotent — a retried POST returns the already-created occurrence.
 */
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
		const currentUser = requireAnyRole(await requireAuth(), [ROLES.STUDENT]);

		await rateLimit(`late-stay-claim:${currentUser.id}`, 30, 60_000);

		const { id } = await params;
		const body = await readBoundedJson(request).catch(() => ({}));
		const dto = claimLateStaySchema.parse(body ?? {});

		const result = await claimLateStayOccurrence(id, dto, currentUser);

		return ApiResponse.created(result);
	} catch (error) {
		return ApiResponse.fromError(error);
	}
}
