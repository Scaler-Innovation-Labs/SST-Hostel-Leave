import type { AnalyticsPeriod } from "./analytics-period.dto";
import type { BreakdownItem, TrendItem } from "./analytics-period.dto";

export type { AnalyticsPeriod, BreakdownItem, TrendItem };

export type ScanTrendPoint = {
  date: string;
  success: number;
  failed: number;
};

export type MovementAnalytics = {
  period: AnalyticsPeriod;
  totalMovementEvents: number;
  byEventType: BreakdownItem[];
  byMovementMethod: BreakdownItem[];
  movementTrend: TrendItem[];
  totalQrPasses: number;
  activeQrPasses: number;
  qrByStatus: BreakdownItem[];
  qrTrend: TrendItem[];
  scanSuccess: number;
  scanFailed: number;
  scanTrend: ScanTrendPoint[];
  topFailureReasons: Array<{ reason: string; count: number }>;
  overdueReturns: number;
};