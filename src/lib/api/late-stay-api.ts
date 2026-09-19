import type { ClaimEligibility } from "@/services/leave/recurring-authorization/claim-eligibility.service";

const BASE = "/api/v1";

export type LateStayAuthorizationRow = {
	id: string;
	studentId: string;
	leaveTypeId: string;
	parentAuthorizationId: string | null;
	version: number;
	validFrom: string;
	validUntil: string;
	startTimeMinutes: number;
	endTimeMinutes: number;
	daysOfWeekMask: number;
	reason: string;
	status: string;
	submittedAt: string;
};

export type LateStayAuthorizationListItem = {
	authorization: LateStayAuthorizationRow;
	student: {
		id: string;
		rollNumber: string;
		userId: string;
	};
	studentUser: {
		id: string;
		fullName: string;
		email: string | null;
	};
	leaveType: {
		id: string;
		code: string;
		name: string;
	};
};

export function getLateStayAuthorizationsUrl(
	query?: { status?: string; page?: number; limit?: number }
): string {
	const params = new URLSearchParams();
	if (query?.status) params.set("status", query.status);
	if (query?.page) params.set("page", String(query.page));
	if (query?.limit) params.set("limit", String(query.limit));
	const qs = params.toString();
	return `${BASE}/late-stay-authorizations${qs ? `?${qs}` : ""}`;
}

export function getClaimEligibilityUrl(): string {
	return `${BASE}/late-stay/claim-eligibility`;
}

export async function createLateStayAuthorization(
	data: Record<string, unknown>
): Promise<unknown> {
	const res = await fetch(`${BASE}/late-stay-authorizations`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	const json = await res.json();
	if (!res.ok || json.success === false) {
		throw new Error(json.error?.message ?? "Failed to submit authorization request");
	}
	return json.data;
}

export async function decideLateStayAuthorization(
	id: string,
	decision: "APPROVED" | "REJECTED",
	comments?: string
): Promise<unknown> {
	const res = await fetch(`${BASE}/late-stay-authorizations/${id}`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ decision, comments }),
	});
	const json = await res.json();
	if (!res.ok || json.success === false) {
		throw new Error(json.error?.message ?? "Failed to record decision");
	}
	return json.data;
}

export async function revokeLateStayAuthorization(
	id: string,
	reason: string
): Promise<unknown> {
	const res = await fetch(`${BASE}/late-stay-authorizations/${id}`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ reason }),
	});
	const json = await res.json();
	if (!res.ok || json.success === false) {
		throw new Error(json.error?.message ?? "Failed to revoke authorization");
	}
	return json.data;
}

export async function claimLateStayOccurrence(
	authorizationId: string
): Promise<unknown> {
	const res = await fetch(
		`${BASE}/late-stay-authorizations/${authorizationId}/claim`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({}),
		}
	);
	const json = await res.json();
	if (!res.ok || json.success === false) {
		throw new Error(json.error?.message ?? "Failed to claim late-stay");
	}
	return json.data;
}

export async function fetchClaimEligibility(): Promise<ClaimEligibility> {
	const res = await fetch(getClaimEligibilityUrl());
	const json = await res.json();
	if (!res.ok || json.success === false) {
		throw new Error(json.error?.message ?? "Failed to check eligibility");
	}
	return json.data;
}
