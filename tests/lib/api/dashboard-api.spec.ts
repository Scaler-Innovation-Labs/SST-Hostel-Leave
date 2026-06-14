import { describe, expect, it } from "vitest";

import { getDashboardStatsUrl } from "@/lib/api/dashboard-api";

describe("dashboard-api", () => {
  describe("getDashboardStatsUrl", () => {
    it("returns stats URL", () => {
      expect(getDashboardStatsUrl()).toBe("/api/v1/dashboard/stats");
    });
  });
});
