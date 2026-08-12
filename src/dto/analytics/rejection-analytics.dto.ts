import type { AnalyticsPeriod } from "./analytics-period.dto";
import type { BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type RejectionAnalytics = {
  period: AnalyticsPeriod;
  totalRejections: number;
  policyRejections: number;
  humanRejections: number;
  bySource: BreakdownItem[];
  byCategory: BreakdownItem[];
  byHostel: BreakdownItem[];
  byLeaveType: BreakdownItem[];
  rejectionTrend: TrendItem[];
};