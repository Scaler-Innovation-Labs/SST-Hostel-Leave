import { systemActor } from "@/constants/audit/actor";
import { AUDIT_ACTION } from "@/constants/audit/audit-action";
import { AUDIT_ENTITY_TYPE } from "@/constants/audit/audit-entity-type";
import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { auditService } from "@/services/audit/audit.service";

/**
 * Expiry pass for recurring late-stay authorizations: any ACTIVE
 * authorization whose validUntil has passed becomes EXPIRED. Composes into
 * the existing runExpireLeavesJob — the ONLY new cron introduced by the
 * recurring-authorization design (recurrence matching itself is a pure
 * query; claims materialize rows; nothing else is scheduled).
 */
export async function expireAuthorizations(
	actor = systemActor("expire-late-stay-authorizations")
) {
	const expired = await lateStayAuthorizationRepository.expireDue(new Date(), undefined);

	for (const authorization of expired) {
		await auditService.record(
			AUDIT_ACTION.EXPIRE,
			AUDIT_ENTITY_TYPE.LATE_STAY_AUTHORIZATION,
			authorization.id,
			actor,
			{
				fromStatus: "ACTIVE",
				toStatus: "EXPIRED",
				validUntil: authorization.validUntil.toISOString(),
			}
		);
	}

	return { count: expired.length };
}
