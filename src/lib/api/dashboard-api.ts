import type { AnalyticsPeriod } from "@/dto/analytics/analytics-period.dto";

const BASE = "/api/v1";

export function getDashboardStatsUrl(
  status?: string,
  period?: AnalyticsPeriod,
  startDate?: string,
  endDate?: string
): string {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  if (period) params.set("period", period);
  if (startDate) params.set("startDate", startDate);
  if (endDate) params.set("endDate", endDate);
  const q = params.toString();
  return q ? `${BASE}/dashboard/stats?${q}` : `${BASE}/dashboard/stats`;
}
