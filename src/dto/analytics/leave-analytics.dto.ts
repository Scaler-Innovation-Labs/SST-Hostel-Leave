import type { AnalyticsPeriod } from "./analytics-period.dto";
import type { BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type StatusTrendPoint = {
  date: string;
  status: string;
  count: number;
};

export type LeaveAnalytics = {
  period: AnalyticsPeriod;
  totalLeaves: number;
  pending: number;
  approved: number;
  rejected: number;
  cancelled: number;
  byStatus: BreakdownItem[];
  statusTrend: StatusTrendPoint[];
  byLeaveType: BreakdownItem[];
  byHostel: BreakdownItem[];
  byDepartment: BreakdownItem[];
  durationDistribution: BreakdownItem[];
  leaveTrend: TrendItem[];
  approvalTimeTrend: Array<{ date: string; avgHours: number }>;
  averageApprovalHours: number | null;
};