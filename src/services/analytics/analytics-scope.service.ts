import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { CurrentUser } from "@/lib/auth/types";
import { getScopedHostelIds, isStaffScopeRestricted } from "@/services/shared/authorization.service";

export type AnalyticsRange = {
  /** Lower bound for queries; the epoch when the period is unbounded. */
  startDate: Date;
  endDate: Date;
  /** Whether the period is bounded (true) or "all time" (false). */
  isBounded: boolean;
};

const PERIOD_DAYS: Record<"7d" | "30d" | "90d", number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

function parseBoundary(
  val: Date | string | null | undefined,
  boundary: "start" | "end"
): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? undefined : val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed) return undefined;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parts = trimmed.split("-").map(Number);
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      if (year !== undefined && month !== undefined && day !== undefined) {
        return boundary === "start"
          ? new Date(year, month - 1, day, 0, 0, 0, 0)
          : new Date(year, month - 1, day, 23, 59, 59, 999);
      }
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export function resolveAnalyticsRange(
  period: AnalyticsPeriod = "30d",
  customStartDate?: Date | string | null,
  customEndDate?: Date | string | null
): AnalyticsRange {
  const now = new Date();

  if (period === "all") {
    return { startDate: new Date(0), endDate: now, isBounded: false };
  }

  if (period === "this_month") {
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    return { startDate, endDate: now, isBounded: true };
  }

  if (period === "last_month") {
    const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    return { startDate, endDate, isBounded: true };
  }

  if (period === "custom") {
    let start = parseBoundary(customStartDate, "start");
    let end = parseBoundary(customEndDate, "end");

    if (!start && !end) {
      const defaultStart = new Date(now);
      defaultStart.setDate(defaultStart.getDate() - 30);
      defaultStart.setHours(0, 0, 0, 0);
      start = defaultStart;
      end = now;
    } else if (!start && end) {
      const defaultStart = new Date(end);
      defaultStart.setDate(defaultStart.getDate() - 30);
      defaultStart.setHours(0, 0, 0, 0);
      start = defaultStart;
    } else if (start && !end) {
      end = now;
    }

    if (start! > end!) {
      const temp = start!;
      start = end;
      end = temp;
    }

    return { startDate: start!, endDate: end!, isBounded: true };
  }

  const days = PERIOD_DAYS[period as keyof typeof PERIOD_DAYS] ?? 30;
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  return { startDate, endDate: now, isBounded: true };
}

/**
 * Hostel ids the current user is restricted to. `undefined` means the user
 * sees system-wide (ALL hostels) data — super-admins and unscoped staff.
 */
export function getAnalyticsHostelScope(currentUser: CurrentUser): string[] | undefined {
  return isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;
}
