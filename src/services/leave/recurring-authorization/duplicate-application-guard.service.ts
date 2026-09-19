import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { ConflictError } from "@/lib/errors";
import { coversWindow } from "@/services/leave/recurring-authorization/evaluate-coverage.service";

/**
 * Domain validation (server-side, not UI): a manual LATE_STAY_COLLEGE
 * application whose window is fully covered by an ACTIVE recurring
 * authorization is rejected — the student must claim instead. Windows
 * outside the authorization's coverage still apply normally.
 *
 * Wired into create-leave.service alongside assertNoConflictingOverlap.
 */
export async function assertNoActiveAuthorizationCoverage(params: {
	studentId: string;
	leaveTypeId: string;
	startAt: Date;
	endAt: Date;
	dbClient?: { select: unknown };
}): Promise<void> {
	const activeAuthorizations =
		await lateStayAuthorizationRepository.findActiveByStudent(
			params.studentId,
			params.leaveTypeId,
			(params.dbClient ?? undefined) as never
		);

	for (const authorization of activeAuthorizations) {
		if (coversWindow(authorization, params.startAt, params.endAt)) {
			throw new ConflictError(
				"You already have an active recurring late-stay authorization covering this period — use the claim flow instead"
			);
		}
	}
}
