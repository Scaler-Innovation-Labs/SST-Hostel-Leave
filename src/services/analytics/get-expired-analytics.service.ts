import { leaveAnalyticsRepository } from "@/db/repositories/leave/leave-analytics.repository";
import type { AnalyticsPeriod, BreakdownItem, ExpiredAnalytics } from "@/dto/analytics/expired-analytics.dto";
import { fillDateRange } from "@/lib/analytics/trend";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

const STEP_LABELS: Record<string, string> = {
  PARENT_APPROVAL: "Parent Approval",
  POC_APPROVAL: "POC Approval",
  ADMIN_APPROVAL: "Admin Approval",
  AUTO_APPROVAL: "Auto Approval",
  NOTIFICATION: "Notification",
};

function formatStepLabel(stepKey: string | null): string {
  if (!stepKey) return "Unassigned";
  return STEP_LABELS[stepKey] ?? stepKey.toLowerCase().replace(/_/g, " ");
}

export async function getExpiredAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d",
  customStartDate?: Date | string | null,
  customEndDate?: Date | string | null
): Promise<ExpiredAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(
    period,
    customStartDate,
    customEndDate
  );

  const rangeStart = isBounded ? startDate : undefined;
  const rangeEnd = isBounded ? endDate : undefined;

  const [
    expiredLeaves,
    expiredExtensions,
    expiredQrPasses,
    byLeaveTypeRaw,
    byPendingStepRaw,
    byReason,
    byHostel,
    byDepartment,
    trendRaw,
  ] = await Promise.all([
    leaveAnalyticsRepository.countExpiredLeaves(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.countExpiredExtensions(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.countExpiredQrPasses(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredByLeaveType(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredByPendingStep(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredByReason(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredByHostel(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredByDepartment(hostelIds, rangeStart, rangeEnd),
    leaveAnalyticsRepository.expiredTrend(startDate, endDate, hostelIds),
  ]);

  const byPendingStep: BreakdownItem[] = byPendingStepRaw.map((row) => ({
    name: formatStepLabel(row.stepKey),
    count: row.count,
  }));

  const byLeaveType: BreakdownItem[] = byLeaveTypeRaw.map((row) => ({
    name: row.name,
    count: row.count,
  }));

  return {
    period,
    totalExpired: expiredLeaves + expiredExtensions,
    expiredLeaves,
    expiredExtensions,
    expiredQrPasses,
    byLeaveType,
    byPendingStep,
    byReason,
    byHostel,
    byDepartment,
    expiredTrend: isBounded
      ? fillDateRange(startDate, endDate, trendRaw)
      : trendRaw.map((row) => ({ date: row.date, value: row.count })),
  };
}
