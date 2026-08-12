import { LEAVE_REJECTION_SOURCE } from "@/constants/leave/leave-rejection-source";
import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";
import { leaveRejectionRepository } from "@/db/repositories/leave/leave-rejection.repository";
import type { AnalyticsPeriod, BreakdownItem, RejectionAnalytics } from "@/dto/analytics/rejection-analytics.dto";
import { fillDateRange } from "@/lib/analytics/trend";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

const STEP_LABELS: Record<string, string> = {
  PARENT_APPROVAL: "Parent",
  POC_APPROVAL: "POC",
  ADMIN_APPROVAL: "Admin",
  AUTO_APPROVAL: "Auto",
  NOTIFICATION: "Notification",
};

function labelForStep(stepKey: string): string {
  return STEP_LABELS[stepKey] ?? stepKey.toLowerCase().replace(/_/g, " ");
}

function mergeBreakdown(...groups: Array<Array<{ name: string | null; count: number }>>): BreakdownItem[] {
  const totals = new Map<string, number>();
  for (const group of groups) {
    for (const item of group) {
      const name = item.name ?? "Unassigned";
      totals.set(name, (totals.get(name) ?? 0) + item.count);
    }
  }
  return [...totals.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function getRejectionAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d"
): Promise<RejectionAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(period);

  const [policyCount, policyTrend, stepBreakdown, categoryRows, humanTrend, humanHostelRows, humanLeaveTypeRows, policyHostelRows, policyLeaveTypeRows] =
    await Promise.all([
      leaveRejectionRepository.countBySource(LEAVE_REJECTION_SOURCE.POLICY, hostelIds, undefined, startDate, endDate),
      leaveRejectionRepository.trendByDateRange(startDate, endDate, LEAVE_REJECTION_SOURCE.POLICY, hostelIds),
      leaveApprovalAnalyticsRepository.rejectionsByStepKey(hostelIds, undefined, startDate, endDate),
      leaveApprovalAnalyticsRepository.rejectionsByCategory(hostelIds, undefined, startDate, endDate),
      leaveApprovalAnalyticsRepository.rejectionsTrend(startDate, endDate, hostelIds),
      leaveApprovalAnalyticsRepository.rejectionsByHostel(hostelIds, undefined, startDate, endDate),
      leaveApprovalAnalyticsRepository.rejectionsByLeaveType(hostelIds, undefined, startDate, endDate),
      leaveRejectionRepository.countByHostel(LEAVE_REJECTION_SOURCE.POLICY, hostelIds, undefined, startDate, endDate),
      leaveRejectionRepository.countByLeaveType(LEAVE_REJECTION_SOURCE.POLICY, hostelIds, undefined, startDate, endDate),
    ]);

  const humanRejections = humanTrend.reduce((acc, row) => acc + row.count, 0);
  const byCategory: BreakdownItem[] = categoryRows.map((row) => ({
    name: row.category ?? "Uncategorized",
    count: row.count,
  }));

  const bySource: BreakdownItem[] = [
    { name: "Policy", count: policyCount },
    ...stepBreakdown.map((row) => ({ name: labelForStep(row.stepKey), count: row.count })),
  ];

  const trendMap = new Map<string, number>();
  for (const row of humanTrend) {
    trendMap.set(row.date, (trendMap.get(row.date) ?? 0) + row.count);
  }
  for (const row of policyTrend) {
    trendMap.set(row.date, (trendMap.get(row.date) ?? 0) + row.count);
  }
  const combinedTrend = [...trendMap.entries()].map(([date, value]) => ({ date, value }));

  return {
    period,
    totalRejections: policyCount + humanRejections,
    policyRejections: policyCount,
    humanRejections,
    bySource,
    byCategory,
    byHostel: mergeBreakdown(humanHostelRows, policyHostelRows),
    byLeaveType: mergeBreakdown(humanLeaveTypeRows, policyLeaveTypeRows),
    rejectionTrend: isBounded ? fillDateRange(startDate, endDate, combinedTrend.map((t) => ({ date: t.date, count: t.value }))) : combinedTrend,
  };
}