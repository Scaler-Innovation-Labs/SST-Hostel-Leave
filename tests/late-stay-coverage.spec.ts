import { describe, expect, it } from "vitest";

import {
	DAY_BIT,
	WEEKDAYS_MASK,
	maskIncludesDay,
	parseDateOnlyToUtcEnd,
	parseDateOnlyToUtcStart,
	parseHHMMToMinutes,
} from "@/constants/leave/late-stay-authorization";
import {
	countEligibleNights,
	coversWindow,
	evaluateCoverage,
} from "@/services/leave/recurring-authorization/evaluate-coverage.service";

/** Mon 2026-09-21 … Fri 2026-09-25 are all weekdays (UTC). */
function utc(h: number, m: number, dayOfMonth = 22): Date {
	// Tue 2026-09-22 by default.
	return new Date(Date.UTC(2026, 8, dayOfMonth, h, m, 0, 0));
}

const MON_FRI_18_22 = {
	validFrom: parseDateOnlyToUtcStart("2026-09-15"),
	validUntil: parseDateOnlyToUtcEnd("2026-10-15"),
	startTimeMinutes: parseHHMMToMinutes("18:00"),
	endTimeMinutes: parseHHMMToMinutes("22:00"),
	daysOfWeekMask: WEEKDAYS_MASK,
};

describe("evaluateCoverage", () => {
	it("covers a weekday evening inside the window", () => {
		// Tue Sep 22, 20:15.
		const result = evaluateCoverage(MON_FRI_18_22, utc(20, 15));
		expect(result.covered).toBe(true);
		expect(result.minutesOfDay).toBe(20 * 60 + 15);
	});

	it("covers the start boundary (18:00) but not the end (22:00)", () => {
		expect(evaluateCoverage(MON_FRI_18_22, utc(18, 0)).covered).toBe(true);
		expect(evaluateCoverage(MON_FRI_18_22, utc(21, 59)).covered).toBe(true);
		expect(evaluateCoverage(MON_FRI_18_22, utc(22, 0)).covered).toBe(false);
		expect(evaluateCoverage(MON_FRI_18_22, utc(22, 0)).reason).toBe(
			"OUTSIDE_DAILY_WINDOW"
		);
	});

	it("rejects a weekend day (DAY_NOT_ALLOWED)", () => {
		// Sun Sep 27, 2026.
		const sunday = new Date(Date.UTC(2026, 8, 27, 20, 0));
		const result = evaluateCoverage(MON_FRI_18_22, sunday);
		expect(result.covered).toBe(false);
		expect(result.reason).toBe("DAY_NOT_ALLOWED");
	});

	it("rejects before validity (BEFORE_VALIDITY)", () => {
		const result = evaluateCoverage(MON_FRI_18_22, utc(20, 0, 14));
		expect(result.covered).toBe(false);
		expect(result.reason).toBe("BEFORE_VALIDITY");
	});

	it("covers the validUntil day but rejects the day after (AFTER_VALIDITY)", () => {
		// Oct 15 is a Thursday — a valid weekday.
		expect(evaluateCoverage(MON_FRI_18_22, utc(20, 0, 15)).covered).toBe(true);

		// Oct 16 is a Friday — weekday, but past validity.
		const after = new Date(Date.UTC(2026, 9, 16, 20, 0));
		const result = evaluateCoverage(MON_FRI_18_22, after);
		expect(result.covered).toBe(false);
		expect(result.reason).toBe("AFTER_VALIDITY");
	});

	it("rejects daytime even on a valid day", () => {
		const result = evaluateCoverage(MON_FRI_18_22, utc(12, 0));
		expect(result.covered).toBe(false);
		expect(result.reason).toBe("OUTSIDE_DAILY_WINDOW");
	});
});

describe("coversWindow", () => {
	it("accepts a window fully inside one evening", () => {
		expect(
			coversWindow(MON_FRI_18_22, utc(18, 30), utc(21, 30))
		).toBe(true);
	});

	it("rejects a window extending past the daily end", () => {
		expect(coversWindow(MON_FRI_18_22, utc(18, 30), utc(22, 30))).toBe(false);
	});

	it("rejects a window outside validity", () => {
		expect(
			coversWindow(MON_FRI_18_22, utc(18, 30, 10), utc(21, 30, 10))
		).toBe(false);
	});
});

describe("countEligibleNights", () => {
	it("counts only masked weekdays in the window", () => {
		// Sep 15 (Tue) → Oct 15 (Thu), 2026: 31 days, 23 Mon–Fri nights.
		expect(countEligibleNights(MON_FRI_18_22)).toBe(23);
	});

	it("counts every day for an all-days mask", () => {
		const allDays = { ...MON_FRI_18_22, daysOfWeekMask: 127 };
		expect(countEligibleNights(allDays)).toBe(31);
	});
});

describe("mask helpers", () => {
	it("maps day indices to bits", () => {
		expect(DAY_BIT.SUNDAY).toBe(1);
		expect(DAY_BIT.SATURDAY).toBe(64);
		expect(maskIncludesDay(WEEKDAYS_MASK, 1)).toBe(true);
		expect(maskIncludesDay(WEEKDAYS_MASK, 0)).toBe(false);
	});
});
