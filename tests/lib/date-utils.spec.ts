import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatRelative,
  formatTimeRemaining,
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
});
