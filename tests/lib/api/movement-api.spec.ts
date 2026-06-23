import { describe, expect, it } from "vitest";

import { getMovementsUrl } from "@/lib/api/movement-api";

describe("movement-api", () => {
  describe("getMovementsUrl", () => {
    it("returns base URL when no query", () => {
      expect(getMovementsUrl()).toBe("/api/v1/movements");
    });

    it("includes eventType param", () => {
      const url = getMovementsUrl({ eventType: "CHECK_IN" });
      expect(url).toBe("/api/v1/movements?eventType=CHECK_IN");
    });

    it("includes studentId param", () => {
      const url = getMovementsUrl({ studentId: "stu-1" });
      expect(url).toBe("/api/v1/movements?studentId=stu-1");
    });

    it("includes date range params", () => {
      const url = getMovementsUrl({ dateFrom: "2024-01-01", dateTo: "2024-01-31" });
      expect(url).toBe("/api/v1/movements?dateFrom=2024-01-01&dateTo=2024-01-31");
    });

    it("includes pagination", () => {
      const url = getMovementsUrl({ page: 3, limit: 50 });
      expect(url).toBe("/api/v1/movements?page=3&limit=50");
    });

    it("omits undefined params", () => {
      const url = getMovementsUrl({ eventType: undefined, page: 1 });
      expect(url).toBe("/api/v1/movements?page=1");
    });
  });
});
