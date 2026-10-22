import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";
import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";
import type { StaffAnalytics, StaffDecisionTrendPoint } from "@/dto/analytics/staff-analytics.dto";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

function fillActivityTrend(
  startDate: Date,
  endDate: Date,
  data: Array<{ date: string; approved: number; rejected: number }>
): StaffDecisionTrendPoint[] {
  const map = new Map<string, { approved: number; rejected: number }>();
  for (const item of data) {
    const key = item.date.slice(0, 10);
    map.set(key, { approved: item.approved, rejected: item.rejected });
  }

  const result: StaffDecisionTrendPoint[] = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const key = current.toISOString().slice(0, 10);
    const existing = map.get(key) ?? { approved: 0, rejected: 0 };
    result.push({
      date: key,
      approved: existing.approved,
      rejected: existing.rejected,
    });
    current.setDate(current.getDate() + 1);
  }

  return result;
}

export async function getStaffAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d"
): Promise<StaffAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(period);

  const [summary, pendingOnStaff, activityTrendRaw, byRole, approvers] =
    await Promise.all([
      leaveApprovalAnalyticsRepository.staffDecisionsSummary(startDate, endDate, hostelIds),
      leaveApprovalAnalyticsRepository.staffPendingCount(hostelIds),
      leaveApprovalAnalyticsRepository.staffActivityTrend(startDate, endDate, hostelIds),
      leaveApprovalAnalyticsRepository.staffDecisionsByRole(startDate, endDate, hostelIds),
      leaveApprovalAnalyticsRepository.staffApproverBreakdown(startDate, endDate, hostelIds),
    ]);

  const activityTrend: StaffDecisionTrendPoint[] = isBounded
    ? fillActivityTrend(startDate, endDate, activityTrendRaw)
    : activityTrendRaw.map((r) => ({
        date: r.date.slice(0, 10),
        approved: r.approved,
        rejected: r.rejected,
      }));

  return {
    period,
    totalDecisions: summary.totalDecisions,
    totalApproved: summary.totalApproved,
    totalRejected: summary.totalRejected,
    pendingOnStaff,
    activeApproversCount: summary.activeApproversCount,
    averageTurnaroundHours: summary.averageTurnaroundHours,
    activityTrend,
    byRole,
    byDecision: [
      { name: "Approved", count: summary.totalApproved },
      { name: "Rejected", count: summary.totalRejected },
    ],
    approvers,
  };
}
