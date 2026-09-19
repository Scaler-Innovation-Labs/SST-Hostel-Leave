import { lateStayAuthorizationRepository } from "@/db/repositories/leave/late-stay-authorization.repository";
import { studentRepository } from "@/db/repositories/student/student.repository";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { AuthorizationError, NotFoundError } from "@/lib/errors";

/**
 * Version history for an authorization lineage. Students may only read
 * their own lineage; POC/admin roles may read any.
 */
export async function getLateStayAuthorizationVersions(
	authorizationId: string,
	currentUser: CurrentUser
) {
	const authorization =
		await lateStayAuthorizationRepository.findById(authorizationId);
	if (!authorization) {
		throw new NotFoundError("LateStayAuthorization");
	}

	// Walk to the lineage root, then list all descendants.
	let rootId = authorizationId;
	let cursor = authorization;
	while (cursor.parentAuthorizationId) {
		rootId = cursor.parentAuthorizationId;
		const parent = await lateStayAuthorizationRepository.findById(rootId);
		if (!parent) break;
		cursor = parent;
	}

	const versions = await lateStayAuthorizationRepository.findByFilters({
		page: 1,
		limit: 100,
	});

	const roleCodes = currentUser.roles as unknown as string[];
	const isStaff = roleCodes.some((role) =>
		[ROLES.POC, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(role as never)
	);

	if (!isStaff) {
		const student = await studentRepository.findByUserId(currentUser.id);
		if (!student || student.id !== authorization.studentId) {
			throw new AuthorizationError("Not your authorization");
		}
	}

	return versions.items
		.map((row) => row.authorization)
		.filter(
			(row) =>
				row.id === rootId || row.parentAuthorizationId === rootId
		)
		.sort((a, b) => a.version - b.version);
}
