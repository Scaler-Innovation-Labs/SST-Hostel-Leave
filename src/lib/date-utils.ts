import { format, parseISO } from "date-fns";

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

export function formatDateTime(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d, yyyy h:mm a");
  } catch {
    return dateStr ?? "—";
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
