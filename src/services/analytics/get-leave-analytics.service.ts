import { LEAVE_REQUEST_STATUS } from "@/constants/leave/leave-status";
import { leaveRepository } from "@/db/repositories/leave/leave.repository";
import { leaveAnalyticsRepository } from "@/db/repositories/leave/leave-analytics.repository";
import { leaveApprovalAnalyticsRepository } from "@/db/repositories/leave/leave-approval-analytics.repository";
import type { AnalyticsPeriod, BreakdownItem, LeaveAnalytics } from "@/dto/analytics/leave-analytics.dto";
import { fillDateRange } from "@/lib/analytics/trend";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

function toBreakdown(rows: Array<{ name: string | null; count: number }>): BreakdownItem[] {
  return rows.map((row) => ({ name: row.name ?? "Unassigned", count: row.count }));
}

export async function getLeaveAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d"
): Promise<LeaveAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(period);

  const [totalLeaves, byStatus, statusTrend, byLeaveType, byHostel, byDepartment, durationDistribution, leaveTrend, approvalTimeTrend, averageApprovalHours] =
    await Promise.all([
      leaveRepository.countAll(hostelIds),
      leaveAnalyticsRepository.statusBreakdown(hostelIds),
      leaveAnalyticsRepository.trendByStatus(startDate, endDate, hostelIds),
      leaveRepository.countByLeaveType(hostelIds),
      leaveAnalyticsRepository.countByHostel(hostelIds),
      leaveAnalyticsRepository.countByDepartment(hostelIds),
      leaveAnalyticsRepository.durationDistribution(hostelIds),
      leaveRepository.countByDateRange(startDate, endDate, undefined, hostelIds),
      leaveAnalyticsRepository.approvalTimeTrend(startDate, endDate, hostelIds),
      leaveApprovalAnalyticsRepository.averageApprovalTime(startDate, hostelIds),
    ]);

  const statusMap = new Map(byStatus.map((row) => [row.status, row.count]));

  return {
    period,
    totalLeaves,
    pending: statusMap.get(LEAVE_REQUEST_STATUS.PENDING) ?? 0,
    approved: statusMap.get(LEAVE_REQUEST_STATUS.APPROVED) ?? 0,
    rejected: statusMap.get(LEAVE_REQUEST_STATUS.REJECTED) ?? 0,
    cancelled: statusMap.get(LEAVE_REQUEST_STATUS.CANCELLED) ?? 0,
    byStatus: byStatus.map((row) => ({ name: row.status, count: row.count })),
    statusTrend,
    byLeaveType,
    byHostel,
    byDepartment: toBreakdown(byDepartment),
    durationDistribution: durationDistribution.map((row) => ({ name: row.bucket, count: row.count })),
    leaveTrend: isBounded ? fillDateRange(startDate, endDate, leaveTrend) : leaveTrend.map((row) => ({ date: row.date, value: row.count })),
    approvalTimeTrend,
    averageApprovalHours,
  };
}