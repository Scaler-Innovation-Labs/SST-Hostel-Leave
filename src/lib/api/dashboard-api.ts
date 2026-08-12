const BASE = "/api/v1";

export function getDashboardStatsUrl(status?: string): string {
  return status ? `${BASE}/dashboard/stats?status=${encodeURIComponent(status)}` : `${BASE}/dashboard/stats`;
}
