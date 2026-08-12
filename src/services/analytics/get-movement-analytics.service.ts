import { movementAnalyticsRepository } from "@/db/repositories/movement/movement-analytics.repository";
import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { AnalyticsPeriod, MovementAnalytics } from "@/dto/analytics/movement-analytics.dto";
import { fillDateRange } from "@/lib/analytics/trend";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

export async function getMovementAnalytics(
  currentUser: CurrentUser,
  period: AnalyticsPeriod = "30d"
): Promise<MovementAnalytics> {
  const hostelIds = getAnalyticsHostelScope(currentUser);
  const { startDate, endDate, isBounded } = resolveAnalyticsRange(period);

  const [byEventType, byMovementMethod, totalQrPasses, activeQrPasses, qrByStatus, scanByResult, scanTrend, topFailureReasons, overdueReturns] =
    await Promise.all([
      movementAnalyticsRepository.countByEventType(startDate, endDate, hostelIds),
      movementAnalyticsRepository.countByMovementMethod(startDate, endDate, hostelIds),
      qrPassRepository.countAll(hostelIds),
      qrPassRepository.countActive(hostelIds),
      movementAnalyticsRepository.qrByStatus(hostelIds),
      movementAnalyticsRepository.qrScanByResult(startDate, endDate, hostelIds),
      movementAnalyticsRepository.qrScanTrend(startDate, endDate, hostelIds),
      movementAnalyticsRepository.topScanFailureReasons(startDate, endDate, 8, hostelIds),
      movementAnalyticsRepository.countOverdueReturns(hostelIds),
    ]);

  const [movementTrend, qrTrend] = await Promise.all([
    movementAnalyticsRepository.trendByDateRange(startDate, endDate, undefined, hostelIds),
    movementAnalyticsRepository.qrTrend(startDate, endDate, hostelIds),
  ]);

  const totalMovementEvents = byEventType.reduce((acc, row) => acc + row.count, 0);

  return {
    period,
    totalMovementEvents,
    byEventType,
    byMovementMethod,
    movementTrend: isBounded ? fillDateRange(startDate, endDate, movementTrend) : movementTrend.map((row) => ({ date: row.date, value: row.count })),
    totalQrPasses,
    activeQrPasses,
    qrByStatus,
    qrTrend: isBounded ? fillDateRange(startDate, endDate, qrTrend) : qrTrend.map((row) => ({ date: row.date, value: row.count })),
    scanSuccess: scanByResult.success,
    scanFailed: scanByResult.failed,
    scanTrend,
    topFailureReasons,
    overdueReturns,
  };
}