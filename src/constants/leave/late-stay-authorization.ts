export const LATE_STAY_AUTH_STATUSES = [
	"PENDING_POC",
	"PENDING_ADMIN",
	"ACTIVE",
	"REJECTED",
	"REVOKED",
	"EXPIRED",
	"SUPERSEDED",
] as const;

export type LateStayAuthStatus =
	(typeof LATE_STAY_AUTH_STATUSES)[number];

export const LATE_STAY_AUTH_STATUS = {
	PENDING_POC: "PENDING_POC",
	PENDING_ADMIN: "PENDING_ADMIN",
	ACTIVE: "ACTIVE",
	REJECTED: "REJECTED",
	REVOKED: "REVOKED",
	EXPIRED: "EXPIRED",
	SUPERSEDED: "SUPERSEDED",
} as const;

/**
 * Day-of-week mask helpers (contract: bit 0 = Sunday … bit 6 = Saturday).
 * A mask of 0 is forbidden (lsa_days_mask_chk); masks > 127 are invalid.
 */
export const DAY_BIT = {
	SUNDAY: 1 << 0,
	MONDAY: 1 << 1,
	TUESDAY: 1 << 2,
	WEDNESDAY: 1 << 3,
	THURSDAY: 1 << 4,
	FRIDAY: 1 << 5,
	SATURDAY: 1 << 6,
} as const;

/** JavaScript Date.getUTCDay()/getDay() value → mask bit. */
export function dayIndexToBit(dayIndex: number): number {
	return 1 << dayIndex;
}

/** "18:00" → 1080. Throws on malformed input (DTOs validate first). */
export function parseHHMMToMinutes(value: string): number {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
	if (!match) {
		throw new Error(`Invalid time "${value}" (expected HH:mm)`);
	}
	return Number(match[1]) * 60 + Number(match[2]);
}

/** "2026-09-15" → UTC midnight instant of that calendar day. */
export function parseDateOnlyToUtcStart(value: string): Date {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) {
		throw new Error(`Invalid date "${value}" (expected YYYY-MM-DD)`);
	}
	return new Date(
		Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	);
}

/** "2026-10-15" → last instant of that calendar day (inclusive end). */
export function parseDateOnlyToUtcEnd(value: string): Date {
	const start = parseDateOnlyToUtcStart(value);
	return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Distinct day indices → bitmask (dedupes, order-independent). */
export function maskFromDays(days: readonly number[]): number {
	let mask = 0;
	for (const day of days) mask |= dayIndexToBit(day);
	return mask;
}

export function maskIncludesDay(mask: number, dayIndex: number): boolean {
	return (mask & dayIndexToBit(dayIndex)) !== 0;
}

/** Monday–Friday convenience mask (0b0111110 = 62). */
export const WEEKDAYS_MASK =
	DAY_BIT.MONDAY |
	DAY_BIT.TUESDAY |
	DAY_BIT.WEDNESDAY |
	DAY_BIT.THURSDAY |
	DAY_BIT.FRIDAY;
