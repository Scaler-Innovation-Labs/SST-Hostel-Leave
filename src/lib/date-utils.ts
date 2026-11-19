import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * One format per data type, everywhere — inconsistency here reads as a bug.
 *
 * Times are 24-hour with the timezone named on first use in a view, dates are
 * "3 March" (with the year only when it is not this one), and relative times
 * appear only under 24 hours. A raw UTC value or an ISO string is never shown.
 */

/** The product's operating timezone. Every timestamp renders here. */
export const OPERATING_TIMEZONE = "IST";

/** India has no DST, so the operating offset is a constant. */
const IST_UTC_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const IST_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const IST_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
});

const IST_DAY_MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const IST_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  weekday: "long",
});

/** Midnight at the start of the given date in IST (00:00:00.000 IST), as an instant. */
export function startOfDayIst(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + IST_UTC_OFFSET_MS);

  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      0,
      0,
      0,
      0
    ) - IST_UTC_OFFSET_MS
  );
}

/** End of the given date in IST (23:59:59.999 IST), as an instant. */
export function endOfDayIst(date: Date = new Date()): Date {
  const shifted = new Date(date.getTime() + IST_UTC_OFFSET_MS);

  return new Date(
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate(),
      23,
      59,
      59,
      999
    ) - IST_UTC_OFFSET_MS
  );
}

/** Backwards-compatible alias for startOfDayIst. */
export const startOfTodayIst = startOfDayIst;

/** Callers hold either an ISO string from the API or an already-parsed Date. */
function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    // If string has no timezone specified, interpret in IST so server running in UTC formats consistently
    if (!value.includes("Z") && !/[+-]\d{2}(:?\d{2})?$/.test(value)) {
      return new Date(value.includes("T") ? `${value}+05:30` : `${value}T00:00:00+05:30`);
    }
    return parseISO(value);
  }
  return new Date(value);
}

export function isSameDayIst(a: Date, b: Date): boolean {
  return startOfDayIst(a).getTime() === startOfDayIst(b).getTime();
}

function isThisYear(date: Date): boolean {
  const istDateYear = new Date(date.getTime() + IST_UTC_OFFSET_MS).getUTCFullYear();
  const istNowYear = new Date(Date.now() + IST_UTC_OFFSET_MS).getUTCFullYear();
  return istDateYear === istNowYear;
}

function formatDayInIst(date: Date): string {
  return isThisYear(date)
    ? IST_DAY_MONTH_FORMATTER.format(date)
    : IST_DAY_MONTH_YEAR_FORMATTER.format(date);
}

function formatTimeInIst(date: Date): string {
  return IST_TIME_FORMATTER.format(date);
}

/**
 * Relative only under 24 hours; past that a reader wants the date, not a
 * count of days to translate.
 */
export function formatRelative(value: Date | string): string {
  try {
    const date = toDate(value);
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
    return formatDayInIst(date);
  } catch {
    return "\u2014";
  }
}

/** `3 March`, or `3 March 2025` outside the current year. */
export function formatDate(value: Date | string): string {
  try {
    const date = toDate(value);
    return formatDayInIst(date);
  } catch {
    return typeof value === "string" ? (value.split("T")[0] ?? "—") : "—";
  }
}

/** "12 Jun 2026" for a Date object — shared by outbox message handlers. */
export function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** `3 March, 18:00 IST`. Within this week, the weekday leads instead. */
export function formatDateTime(value: Date | string): string {
  try {
    const date = toDate(value);
    const time = formatTimeInIst(date);
    if (isWithinWeek(date)) {
      return `${IST_WEEKDAY_FORMATTER.format(date)}, ${time} ${OPERATING_TIMEZONE}`;
    }
    return `${formatDayInIst(date)}, ${time} ${OPERATING_TIMEZONE}`;
  } catch {
    return "\u2014";
  }
}

/** Compact duration: `1h 30m`, never `90 minutes`. */
export function formatTimeRemaining(value: Date | string): string {
  try {
    const target = toDate(value);
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
export function formatDateRange(
  startValue: Date | string,
  endValue: Date | string
): string {
  try {
    const start = toDate(startValue);
    const end = toDate(endValue);

    if (isSameDayIst(start, end)) {
      return `${formatDayInIst(start)}, ${formatTimeInIst(start)}\u2013${formatTimeInIst(end)} ${OPERATING_TIMEZONE}`;
    }

    const startFmt = `${formatDayInIst(start)}, ${formatTimeInIst(start)}`;
    if (isToday(end)) return `${startFmt} \u2192 today, ${formatTimeInIst(end)} ${OPERATING_TIMEZONE}`;
    if (isTomorrow(end)) return `${startFmt} \u2192 tomorrow, ${formatTimeInIst(end)} ${OPERATING_TIMEZONE}`;

    return `${startFmt} \u2192 ${formatDayInIst(end)}, ${formatTimeInIst(end)} ${OPERATING_TIMEZONE}`;
  } catch {
    return "\u2014";
  }
}

function isToday(date: Date): boolean {
  return isSameDayIst(date, new Date());
}

function isTomorrow(date: Date): boolean {
  return isSameDayIst(date, new Date(Date.now() + 24 * 60 * 60 * 1000));
}

/** Inside the next or previous six days, where a weekday name still orients. */
function isWithinWeek(date: Date): boolean {
  const days = Math.abs((startOfDayIst(date).getTime() - startOfDayIst(new Date()).getTime()) / (24 * 60 * 60 * 1000));
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

/** Compute ISO date boundaries from a date-range label in IST. */
export function computeDateRange(range: string): { dateFrom?: string; dateTo?: string } {
  if (!range) return {};
  const now = new Date();

  switch (range) {
    case "today": {
      return {
        dateFrom: startOfDayIst(now).toISOString(),
        dateTo: endOfDayIst(now).toISOString(),
      };
    }
    case "week": {
      const istNow = new Date(now.getTime() + IST_UTC_OFFSET_MS);
      const dayOfWeek = istNow.getUTCDay();
      const daysSinceMonday = (dayOfWeek + 6) % 7;
      const monday = new Date(now.getTime() - daysSinceMonday * 24 * 60 * 60 * 1000);
      const sunday = new Date(monday.getTime() + 6 * 24 * 60 * 60 * 1000);
      return {
        dateFrom: startOfDayIst(monday).toISOString(),
        dateTo: endOfDayIst(sunday).toISOString(),
      };
    }
    case "month": {
      const istNow = new Date(now.getTime() + IST_UTC_OFFSET_MS);
      const year = istNow.getUTCFullYear();
      const month = istNow.getUTCMonth();
      const firstDay = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0) - IST_UTC_OFFSET_MS);
      const lastDay = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999) - IST_UTC_OFFSET_MS);
      return {
        dateFrom: firstDay.toISOString(),
        dateTo: lastDay.toISOString(),
      };
    }
    default:
      return {};
  }
}
