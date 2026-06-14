import { describe, expect, it } from "vitest";

import { getApprovalsUrl } from "@/lib/api/approval-api";

describe("approval-api", () => {
  describe("getApprovalsUrl", () => {
    it("returns base URL when no query", () => {
      expect(getApprovalsUrl()).toBe("/api/v1/approvals");
    });

    it("includes query params", () => {
      const url = getApprovalsUrl({ status: "PENDING", limit: 20 });
      expect(url).toBe("/api/v1/approvals?status=PENDING&limit=20");
    });

    it("includes date range params", () => {
      const url = getApprovalsUrl({ dateFrom: "2024-01-01", dateTo: "2024-12-31" });
      expect(url).toBe("/api/v1/approvals?dateFrom=2024-01-01&dateTo=2024-12-31");
    });

    it("includes search param", () => {
      const url = getApprovalsUrl({ search: "john" });
      expect(url).toBe("/api/v1/approvals?search=john");
    });
  });
});
