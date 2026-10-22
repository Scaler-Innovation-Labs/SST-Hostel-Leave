import type { AnalyticsPeriod, BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type StaffApproverSummary = {
  userId: string;
  name: string;
  role: string;
  approvedCount: number;
  rejectedCount: number;
  totalDecisions: number;
  averageTurnaroundHours: number | null;
};

export type StaffRoleSummary = {
  role: string;
  approvedCount: number;
  rejectedCount: number;
  totalDecisions: number;
  averageTurnaroundHours: number | null;
};

export type StaffDecisionTrendPoint = {
  date: string;
  approved: number;
  rejected: number;
};

export type StaffAnalytics = {
  period: AnalyticsPeriod;
  totalDecisions: number;
  totalApproved: number;
  totalRejected: number;
  pendingOnStaff: number;
  activeApproversCount: number;
  averageTurnaroundHours: number | null;
  activityTrend: StaffDecisionTrendPoint[];
  byRole: StaffRoleSummary[];
  byDecision: BreakdownItem[];
  approvers: StaffApproverSummary[];
};
