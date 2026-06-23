import { describe, expect, it } from "vitest";

import { getLeaveUrl, getLeavesUrl, getLeaveTypesUrl } from "@/lib/api/leave-api";

describe("leave-api", () => {
  describe("getLeavesUrl", () => {
    it("returns base URL when no query", () => {
      expect(getLeavesUrl()).toBe("/api/v1/leaves");
    });

    it("includes optional query params", () => {
      const url = getLeavesUrl({ status: "PENDING", page: 2, limit: 10 });
      expect(url).toBe("/api/v1/leaves?status=PENDING&page=2&limit=10");
    });

    it("omits undefined params", () => {
      const url = getLeavesUrl({ status: "APPROVED", search: undefined });
      expect(url).toBe("/api/v1/leaves?status=APPROVED");
    });

    it("includes studentId when provided", () => {
      const url = getLeavesUrl({ studentId: "stu-1" });
      expect(url).toBe("/api/v1/leaves?studentId=stu-1");
    });
  });

  describe("getLeaveUrl", () => {
    it("returns URL with id", () => {
      expect(getLeaveUrl("abc-123")).toBe("/api/v1/leaves/abc-123");
    });
  });

  describe("getLeaveTypesUrl", () => {
    it("returns leave types URL", () => {
      expect(getLeaveTypesUrl()).toBe("/api/v1/leave-types");
    });
  });
});
