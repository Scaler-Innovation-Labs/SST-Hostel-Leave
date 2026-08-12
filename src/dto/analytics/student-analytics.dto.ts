import type { AnalyticsPeriod } from "./analytics-period.dto";
import type { BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type StudentAnalytics = {
  period: AnalyticsPeriod;
  totalUsers: number;
  totalStudents: number;
  inHostel: number;
  onLeave: number;
  overdue: number;
  byHostel: BreakdownItem[];
  byDepartment: BreakdownItem[];
  byAcademicGroup: BreakdownItem[];
  byGender: BreakdownItem[];
  trend: TrendItem[];
};