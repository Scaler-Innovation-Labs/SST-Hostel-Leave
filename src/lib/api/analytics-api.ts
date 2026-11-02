import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";

const BASE = "/api/v1";

function buildAnalyticsUrl(
  endpoint: string,
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  const params = new URLSearchParams({ period });
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  return `${BASE}/analytics/${endpoint}?${params.toString()}`;
}

export function getStudentAnalyticsUrl(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  return buildAnalyticsUrl("students", period, startDate, endDate);
}

export function getLeaveAnalyticsUrl(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  return buildAnalyticsUrl("leaves", period, startDate, endDate);
}

export function getMovementAnalyticsUrl(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  return buildAnalyticsUrl("movements", period, startDate, endDate);
}

export function getRejectionAnalyticsUrl(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  return buildAnalyticsUrl("rejections", period, startDate, endDate);
}

export function getStaffAnalyticsUrl(
  period: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  return buildAnalyticsUrl("staff", period, startDate, endDate);
}
