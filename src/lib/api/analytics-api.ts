import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";

const BASE = "/api/v1";

export function getStudentAnalyticsUrl(period: AnalyticsPeriod): string {
  return `${BASE}/analytics/students?period=${encodeURIComponent(period)}`;
}

export function getLeaveAnalyticsUrl(period: AnalyticsPeriod): string {
  return `${BASE}/analytics/leaves?period=${encodeURIComponent(period)}`;
}

export function getMovementAnalyticsUrl(period: AnalyticsPeriod): string {
  return `${BASE}/analytics/movements?period=${encodeURIComponent(period)}`;
}

export function getRejectionAnalyticsUrl(period: AnalyticsPeriod): string {
  return `${BASE}/analytics/rejections?period=${encodeURIComponent(period)}`;
}