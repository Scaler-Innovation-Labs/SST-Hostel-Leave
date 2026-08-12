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

const PERIOD_DAYS: Record<Exclude<AnalyticsPeriod, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

export function resolveAnalyticsRange(period: AnalyticsPeriod = "30d"): AnalyticsRange {
  const endDate = new Date();
  if (period === "all") {
    return { startDate: new Date(0), endDate, isBounded: false };
  }
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - PERIOD_DAYS[period]);
  return { startDate, endDate, isBounded: true };
}

/**
 * Hostel ids the current user is restricted to. `undefined` means the user
 * sees system-wide (ALL hostels) data — super-admins and unscoped staff.
 */
export function getAnalyticsHostelScope(currentUser: CurrentUser): string[] | undefined {
  return isStaffScopeRestricted(currentUser) ? getScopedHostelIds(currentUser) : undefined;
}