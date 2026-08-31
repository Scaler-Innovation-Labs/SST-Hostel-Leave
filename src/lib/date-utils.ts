import { differenceInCalendarDays, format, parseISO } from "date-fns";

/**
 * One format per data type, everywhere — inconsistency here reads as a bug.
 *
 * Times are 24-hour with the timezone named on first use in a view, dates are
 * "3 March" (with the year only when it is not this one), and relative times
 * appear only under 24 hours. A raw UTC value or an ISO string is never shown.
 */

/** The product's operating timezone. Every timestamp renders here. */
export const OPERATING_TIMEZONE = "IST";

/** 24-hour clock. `18:00`, never `6:00 PM`. */
const TIME = "HH:mm";
/** `3 March`. */
const DAY_MONTH = "d MMMM";
/** `3 March 2025` — only when the date is not in the current year. */
const DAY_MONTH_YEAR = "d MMMM yyyy";

function isThisYear(date: Date): boolean {
  return date.getFullYear() === new Date().getFullYear();
}

function dayPattern(date: Date): string {
  return isThisYear(date) ? DAY_MONTH : DAY_MONTH_YEAR;
}

/**
 * Relative only under 24 hours; past that a reader wants the date, not a
 * count of days to translate.
 */
export function formatRelative(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const diffMs = Date.now() - date.getTime();
    const future = diffMs < 0;
    const mins = Math.floor(Math.abs(diffMs) / 60000);
    const hours = Math.floor(mins / 60);

    if (mins < 1) return "just now";
    if (mins < 60) {
      const unit = mins === 1 ? "minute" : "minutes";
      return future ? `in ${mins} ${unit}` : `${mins} ${unit} ago`;
    }
    if (hours < 24) {
      const unit = hours === 1 ? "hour" : "hours";
      return future ? `in ${hours} ${unit}` : `${hours} ${unit} ago`;
    }
    return format(date, dayPattern(date));
  } catch {
    return "\u2014";
  }
}

/** `3 March`, or `3 March 2025` outside the current year. */
export function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    return format(date, dayPattern(date));
  } catch {
    return dateStr.split("T")[0] ?? "\u2014";
  }
}

/** "12 Jun 2026" for a Date object — shared by outbox message handlers. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `3 March, 18:00 IST`. Within this week, the weekday leads instead. */
export function formatDateTime(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const time = format(date, TIME);
    if (isWithinWeek(date)) {
      return `${format(date, "EEEE")}, ${time} ${OPERATING_TIMEZONE}`;
    }
    return `${format(date, dayPattern(date))}, ${time} ${OPERATING_TIMEZONE}`;
  } catch {
    return "\u2014";
  }
}

/** Compact duration: `1h 30m`, never `90 minutes`. */
export function formatTimeRemaining(dateStr: string): string {
  try {
    const target = parseISO(dateStr);
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return "Expired";

    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h left`;
    if (hours > 0) return `${hours}h ${mins % 60}m left`;
    return `${mins}m left`;
  } catch {
    return "\u2014";
  }
}

/**
 * `3 March, 18:00\u201319:00 IST` for a single day; `3 March \u2192 5 March` across
 * days. The timezone is named once, on the times it applies to.
 */
export function formatDateRange(startStr: string, endStr: string): string {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);

    if (start.toDateString() === end.toDateString()) {
      return `${format(start, dayPattern(start))}, ${format(start, TIME)}\u2013${format(end, TIME)} ${OPERATING_TIMEZONE}`;
    }

    const startFmt = `${format(start, dayPattern(start))}, ${format(start, TIME)}`;
    if (isToday(end)) return `${startFmt} \u2192 today, ${format(end, TIME)} ${OPERATING_TIMEZONE}`;
    if (isTomorrow(end)) return `${startFmt} \u2192 tomorrow, ${format(end, TIME)} ${OPERATING_TIMEZONE}`;

    return `${startFmt} \u2192 ${format(end, dayPattern(end))}, ${format(end, TIME)} ${OPERATING_TIMEZONE}`;
  } catch {
    return "\u2014";
  }
}

function isToday(date: Date): boolean {
  const now = new Date();
  return date.toDateString() === now.toDateString();
}

function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return date.toDateString() === tomorrow.toDateString();
}

/** Inside the next or previous six days, where a weekday name still orients. */
function isWithinWeek(date: Date): boolean {
  const days = Math.abs(differenceInCalendarDays(date, new Date()));
  return days < 7;
}

/**
 * Human-readable leave duration based on calendar-day boundaries crossed.
 * Unlike `differenceInDays` (which truncates), a leave spanning midnight
 * (e.g. 11 PM → 1 AM) counts as 1 day, and a same-calendar-day leave is
 * "Same day".
 */
export function getDurationLabel(
  start: Date | string,
  end: Date | string,
  opts?: { short?: boolean }
): string {
  try {
    const startDate = typeof start === "string" ? parseISO(start) : start;
    const endDate = typeof end === "string" ? parseISO(end) : end;
    const days = differenceInCalendarDays(endDate, startDate);
    if (days <= 0) return "Same day";
    return opts?.short ? `${days}d` : `${days} day${days > 1 ? "s" : ""}`;
  } catch {
    return "—";
  }
}

/** Date-range filter option definitions. */
export const DATE_RANGE_OPTIONS = [
  { value: "", label: "All Time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
] as const;

/** Compute ISO date boundaries from a date-range label. */
export function computeDateRange(range: string): { dateFrom?: string; dateTo?: string } {
  if (!range) return {};
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case "today": {
      return {
        dateFrom: startOfDay(now).toISOString(),
        dateTo: endOfDay(now).toISOString(),
      };
    }
    case "week": {
      const dayOfWeek = now.getDay();
      const monday = new Date(now);
      monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7)); // Monday
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return {
        dateFrom: startOfDay(monday).toISOString(),
        dateTo: endOfDay(sunday).toISOString(),
      };
    }
    case "month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        dateFrom: startOfDay(firstDay).toISOString(),
        dateTo: endOfDay(lastDay).toISOString(),
      };
    }
    default:
      return {};
  }
}
