import { describe, expect, it } from "vitest";

import { getDashboardStatsUrl } from "@/lib/api/dashboard-api";

describe("dashboard-api", () => {
  describe("getDashboardStatsUrl", () => {
    it("returns stats URL", () => {
      expect(getDashboardStatsUrl()).toBe("/api/v1/dashboard/stats");
    });

    it("appends status query param when provided", () => {
      expect(getDashboardStatsUrl("APPROVED")).toBe("/api/v1/dashboard/stats?status=APPROVED");
    });

    it("appends period and custom date range when provided", () => {
      expect(getDashboardStatsUrl("APPROVED", "custom", "2026-05-01", "2026-05-15")).toBe(
        "/api/v1/dashboard/stats?status=APPROVED&period=custom&startDate=2026-05-01&endDate=2026-05-15"
      );
    });
  });
});
