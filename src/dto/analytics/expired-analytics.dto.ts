import type { AnalyticsPeriod, BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type ExpiredAnalytics = {
  period: AnalyticsPeriod;
  totalExpired: number;
  expiredLeaves: number;
  expiredExtensions: number;
  expiredQrPasses: number;
  byLeaveType: BreakdownItem[];
  byPendingStep: BreakdownItem[];
  byReason: BreakdownItem[];
  byHostel: BreakdownItem[];
  byDepartment: BreakdownItem[];
  expiredTrend: TrendItem[];
};
