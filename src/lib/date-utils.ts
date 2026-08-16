import { differenceInCalendarDays, format, parseISO } from "date-fns";

export function formatRelative(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return format(date, "MMM d");
  } catch {
    return "—";
  }
}

export function formatDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy");
  } catch {
    return dateStr.split("T")[0] ?? "—";
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

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr ?? "—";
  }
}

export function formatTimeRemaining(dateStr: string): string {
  try {
    const target = parseISO(dateStr);
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return "Expired";

    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h remaining`;
    if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m remaining`;
    return `${diffMins}m remaining`;
  } catch {
    return "—";
  }
}

export function formatDateRange(startStr: string, endStr: string): string {
  try {
    const start = parseISO(startStr);
    const end = parseISO(endStr);
    const now = new Date();
    const isSameDay = start.toDateString() === end.toDateString();
    const isThisYear = start.getFullYear() === now.getFullYear();

    if (isSameDay) {
      return `${format(start, isThisYear ? "MMM d" : "MMM d, yyyy")}, ${format(start, "h:mm a")} – ${format(end, "h:mm a")}`;
    }

    const startFmt = format(start, isThisYear ? "MMM d" : "MMM d, yyyy");
    const endFmt = format(end, isThisYear ? "MMM d" : "MMM d, yyyy");

    if (isToday(end)) return `${startFmt} → Today`;
    if (isTomorrow(end)) return `${startFmt} → Tomorrow`;

    return `${startFmt} → ${endFmt}`;
  } catch {
    return "—";
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
