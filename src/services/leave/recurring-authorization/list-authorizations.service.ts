import { and, count, desc, eq, inArray } from "drizzle-orm";

import { type LateStayAuthStatus } from "@/constants/leave/late-stay-authorization";
import { lateStayAuthorizations, leaveTypes, students, users } from "@/db";
import { ROLES } from "@/lib/auth/roles";
import type { CurrentUser } from "@/lib/auth/types";
import { db } from "@/lib/db";

/**
 * Role-scoped authorization listing.
 * - STUDENT: own authorizations only
 * - POC: students in the POC's assigned hostels (unrestricted when no
 *   hostel assignment)
 * - ADMIN / SUPER_ADMIN: all
 */
export async function listLateStayAuthorizations(
	query: { status?: string; page: number; limit: number },
	currentUser: CurrentUser
) {
	const roleCodes = currentUser.roles as unknown as string[];

	const conditions = [];

	if (roleCodes.includes(ROLES.STUDENT) && roleCodes.length === 1) {
		const student = await db
			.select({ id: students.id })
			.from(students)
			.where(eq(students.userId, currentUser.id))
			.limit(1);

		if (!student[0]) {
			return { items: [], total: 0, page: query.page, limit: query.limit, totalPages: 1 };
		}
		conditions.push(eq(lateStayAuthorizations.studentId, student[0].id));
	} else if (roleCodes.includes(ROLES.POC)) {
		// Scoped staff: restrict to students whose user account is assigned
		// to one of the POC's hostels (hostelId lives on users).
		const hostelIds = (currentUser.roleScopes ?? [])
			.map((scope) => scope.scopeId)
			.filter((id): id is string => id !== null);

		if (hostelIds.length > 0) {
			conditions.push(inArray(users.hostelId, hostelIds));
		}
	}

	if (query.status) {
		conditions.push(
			eq(
				lateStayAuthorizations.status,
				query.status as LateStayAuthStatus
			)
		);
	}

	const where = conditions.length > 0 ? and(...conditions) : undefined;

	const rows = await db
		.select({
			authorization: lateStayAuthorizations,
			student: students,
			studentUser: users,
			leaveType: leaveTypes,
		})
		.from(lateStayAuthorizations)
		.innerJoin(students, eq(lateStayAuthorizations.studentId, students.id))
		.innerJoin(users, eq(students.userId, users.id))
		.innerJoin(leaveTypes, eq(lateStayAuthorizations.leaveTypeId, leaveTypes.id))
		.where(where)
		.orderBy(desc(lateStayAuthorizations.submittedAt))
		.limit(query.limit)
		.offset((query.page - 1) * query.limit);

	const countRows = await db
		.select({ count: count() })
		.from(lateStayAuthorizations)
		.innerJoin(students, eq(lateStayAuthorizations.studentId, students.id))
		.where(where);

	return {
		items: rows,
		total: countRows[0]?.count ?? 0,
		page: query.page,
		limit: query.limit,
		totalPages: Math.max(1, Math.ceil((countRows[0]?.count ?? 0) / query.limit)),
	};
}
