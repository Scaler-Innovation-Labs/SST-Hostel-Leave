import {
	maskIncludesDay,
} from "@/constants/leave/late-stay-authorization";

/**
 * Pure recurrence evaluation (Layer 1 → "is this instant covered?").
 *
 * No DB access, no side effects — a temporal predicate over an
 * authorization's constraints. Everything else (claim flow, duplicate
 * guard, eligibility endpoint) delegates here.
 *
 * All date math is UTC-of-input by convention: the caller passes instants
 * already normalized to the campus timezone (IST). A "day" is the UTC
 * calendar day of the instant; weekday uses the same convention.
 *
 * Contract:
 *   covered =
 *     validFrom <= instant <= validUntil (end-inclusive, full day)
 *     AND weekday of instant ∈ daysOfWeekMask
 *     AND startTimeMinutes <= minutes-of-day < endTimeMinutes
 *
 * The daily window is half-open [start, end): 18:00–22:00 covers 20:15 and
 * 21:59:59, but not 22:00 — matching "stay until 10 PM" semantics (the
 * student must be back at end).
 */

export type CoverageAuthorization = {
	validFrom: Date;
	validUntil: Date;
	startTimeMinutes: number;
	endTimeMinutes: number;
	daysOfWeekMask: number;
};

export type CoverageResult = {
	covered: boolean;
	/** Human-readable reason when not covered (used by claim guards). */
	reason?:
		| "BEFORE_VALIDITY"
		| "AFTER_VALIDITY"
		| "DAY_NOT_ALLOWED"
		| "OUTSIDE_DAILY_WINDOW";
	/** minutes-of-day of the evaluated instant (diagnostics/UI). */
	minutesOfDay: number;
	/** UTC weekday index 0–6 of the evaluated instant. */
	dayOfWeek: number;
};

function extractMinutesOfDay(instant: Date): number {
	return instant.getUTCHours() * 60 + instant.getUTCMinutes();
}

export function evaluateCoverage(
	authorization: CoverageAuthorization,
	instant: Date
): CoverageResult {
	const minutesOfDay = extractMinutesOfDay(instant);
	const dayOfWeek = instant.getUTCDay();

	const startOfDay = Date.UTC(
		instant.getUTCFullYear(),
		instant.getUTCMonth(),
		instant.getUTCDate()
	);

	if (instant.getTime() < authorization.validFrom.getTime()) {
		return { covered: false, reason: "BEFORE_VALIDITY", minutesOfDay, dayOfWeek };
	}

	// validUntil is inclusive through the end of that calendar day: the
	// instant's calendar day must be <= validUntil's calendar day.
	const validUntilDayStart = Date.UTC(
		authorization.validUntil.getUTCFullYear(),
		authorization.validUntil.getUTCMonth(),
		authorization.validUntil.getUTCDate()
	);
	if (startOfDay > validUntilDayStart) {
		return { covered: false, reason: "AFTER_VALIDITY", minutesOfDay, dayOfWeek };
	}

	if (!maskIncludesDay(authorization.daysOfWeekMask, dayOfWeek)) {
		return { covered: false, reason: "DAY_NOT_ALLOWED", minutesOfDay, dayOfWeek };
	}

	if (
		minutesOfDay < authorization.startTimeMinutes ||
		minutesOfDay >= authorization.endTimeMinutes
	) {
		return {
			covered: false,
			reason: "OUTSIDE_DAILY_WINDOW",
			minutesOfDay,
			dayOfWeek,
		};
	}

	return { covered: true, minutesOfDay, dayOfWeek };
}

/**
 * Convenience: does the authorization cover the full window [windowStart,
 * windowEnd]? Used by the duplicate-application guard — a manual
 * application is only rejected when the authorization covers it entirely.
 * The window must lie within a single calendar day for recurring coverage.
 */
export function coversWindow(
	authorization: CoverageAuthorization,
	windowStart: Date,
	windowEnd: Date
): boolean {
	if (windowEnd.getTime() < windowStart.getTime()) return false;

	return (
		evaluateCoverage(authorization, windowStart).covered &&
		evaluateCoverage(authorization, windowEnd).covered
	);
}

/**
 * Eligible-night count for reporting (Layer 1 metric): number of calendar
 * days in [validFrom, validUntil] whose weekday is in the mask. Bounded by
 * construction (product max window ~1 year).
 */
export function countEligibleNights(authorization: CoverageAuthorization): number {
	let count = 0;

	const cursor = new Date(
		Date.UTC(
			authorization.validFrom.getUTCFullYear(),
			authorization.validFrom.getUTCMonth(),
			authorization.validFrom.getUTCDate()
		)
	);
	const untilDay = Date.UTC(
		authorization.validUntil.getUTCFullYear(),
		authorization.validUntil.getUTCMonth(),
		authorization.validUntil.getUTCDate()
	);

	while (cursor.getTime() <= untilDay) {
		if (maskIncludesDay(authorization.daysOfWeekMask, cursor.getUTCDay())) {
			count += 1;
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return count;
}
