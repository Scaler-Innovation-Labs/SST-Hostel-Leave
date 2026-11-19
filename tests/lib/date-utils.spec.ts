import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeDateRange,
  endOfDayIst,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelative,
  formatShortDate,
  formatTimeRemaining,
  isSameDayIst,
  startOfDayIst,
  startOfTodayIst,
} from "@/lib/date-utils";

/**
 * One format per data type. These lock §10.9 down: 24-hour times with the
 * timezone named, "3 March" dates, relative only under 24 hours, and never a
 * raw ISO string leaking to the screen.
 */
const NOW = new Date("2026-03-03T12:00:00");

describe("date formatting", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a date in the current year without the year", () => {
    expect(formatDate("2026-03-03T09:00:00")).toBe("3 March");
  });

  it("includes the year outside the current one", () => {
    expect(formatDate("2025-03-03T09:00:00")).toBe("3 March 2025");
  });

  it("uses a 24-hour clock and names the timezone", () => {
    const result = formatDateTime("2026-06-20T18:30:00");
    expect(result).toContain("18:30");
    expect(result).toContain("IST");
    expect(result).not.toMatch(/[AP]M/);
  });

  it("leads with the weekday inside the week", () => {
    expect(formatDateTime("2026-03-05T18:00:00")).toBe("Thursday, 18:00 IST");
  });

  it("renders a same-day range as one date and two times", () => {
    expect(formatDateRange("2026-06-20T18:00:00", "2026-06-20T19:00:00")).toBe(
      "20 June, 18:00–19:00 IST"
    );
  });

  it("goes relative only under 24 hours", () => {
    expect(formatRelative("2026-03-03T11:40:00")).toBe("20 minutes ago");
    expect(formatRelative("2026-03-03T14:00:00")).toBe("in 2 hours");
    expect(formatRelative("2026-02-20T09:00:00")).toBe("20 February");
  });

  it("formats a remaining duration compactly", () => {
    expect(formatTimeRemaining("2026-03-03T13:30:00")).toBe("1h 30m left");
    expect(formatTimeRemaining("2026-03-03T11:00:00")).toBe("Expired");
  });

  it("never returns an ISO string", () => {
    for (const value of [
      formatDate("2026-03-03T09:00:00"),
      formatDateTime("2026-03-03T09:00:00"),
      formatDateRange("2026-03-03T09:00:00", "2026-03-04T09:00:00"),
    ]) {
      expect(value).not.toMatch(/\d{4}-\d{2}-\d{2}/);
      expect(value).not.toMatch(/\dT\d/);
    }
  });

  it("formats UTC timestamps into IST accurately", () => {
    // 13:00 UTC = 18:30 IST
    expect(formatDateTime("2026-06-20T13:00:00Z")).toContain("18:30 IST");
  });

  it("formats short date in IST", () => {
    const d = new Date("2026-06-20T13:00:00Z");
    expect(formatShortDate(d)).toBe("20 Jun 2026");
  });

  it("checks same day in IST across UTC boundary", () => {
    // 2026-03-03 23:00 IST is 2026-03-03 17:30 UTC
    // 2026-03-03 01:00 IST is 2026-03-02 19:30 UTC
    const d1 = new Date("2026-03-03T17:30:00Z");
    const d2 = new Date("2026-03-02T19:30:00Z");
    expect(isSameDayIst(d1, d2)).toBe(true);
  });
});

describe("computeDateRange", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T06:30:00Z")); // 12:00 IST on Tuesday 3 March 2026
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("computes today boundaries strictly in IST", () => {
    const range = computeDateRange("today");
    expect(range.dateFrom).toBe("2026-03-02T18:30:00.000Z"); // 00:00 IST
    expect(range.dateTo).toBe("2026-03-03T18:29:59.999Z"); // 23:59:59.999 IST
  });

  it("computes week boundaries in IST", () => {
    const range = computeDateRange("week");
    // Tuesday March 3 -> Monday was March 2
    expect(range.dateFrom).toBe("2026-03-01T18:30:00.000Z"); // Monday 00:00 IST
    expect(range.dateTo).toBe("2026-03-08T18:29:59.999Z"); // Sunday 23:59:59.999 IST
  });

  it("computes month boundaries in IST", () => {
    const range = computeDateRange("month");
    expect(range.dateFrom).toBe("2026-02-28T18:30:00.000Z"); // March 1 00:00 IST
    expect(range.dateTo).toBe("2026-03-31T18:29:59.999Z"); // March 31 23:59:59.999 IST
  });
});

describe("startOfDayIst / startOfTodayIst", () => {
  it("uses the IST calendar day around the UTC boundary", () => {
    expect(
      startOfTodayIst(new Date("2026-03-03T18:29:59Z")).toISOString()
    ).toBe("2026-03-02T18:30:00.000Z");
    expect(
      startOfTodayIst(new Date("2026-03-03T18:30:00Z")).toISOString()
    ).toBe("2026-03-03T18:30:00.000Z");
  });

  it("computes midnight (00:00:00.000 IST) for any given date", () => {
    // 2026-07-15 14:00 IST -> 2026-07-14 18:30:00.000Z
    const input = new Date("2026-07-15T08:30:00.000Z");
    const result = startOfDayIst(input);
    expect(result.toISOString()).toBe("2026-07-14T18:30:00.000Z");
  });
});

describe("endOfDayIst", () => {
  it("computes end of day (23:59:59.999 IST) for any given date", () => {
    // 2026-07-15 14:00 IST -> 2026-07-15 18:29:59.999Z
    const input = new Date("2026-07-15T08:30:00.000Z");
    const result = endOfDayIst(input);
    expect(result.toISOString()).toBe("2026-07-15T18:29:59.999Z");
  });
});
