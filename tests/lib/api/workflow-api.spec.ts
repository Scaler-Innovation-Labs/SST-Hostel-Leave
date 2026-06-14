import { describe, expect, it } from "vitest";

import { getWorkflowsUrl } from "@/lib/api/workflow-api";

describe("workflow-api", () => {
  describe("getWorkflowsUrl", () => {
    it("returns base URL when no params", () => {
      expect(getWorkflowsUrl()).toBe("/api/v1/workflows");
    });

    it("includes isActive param", () => {
      const url = getWorkflowsUrl({ isActive: true });
      expect(url).toBe("/api/v1/workflows?isActive=true");
    });

    it("includes search param", () => {
      const url = getWorkflowsUrl({ search: "leave" });
      expect(url).toBe("/api/v1/workflows?search=leave");
    });

    it("includes pagination params", () => {
      const url = getWorkflowsUrl({ page: 2, limit: 10 });
      expect(url).toBe("/api/v1/workflows?page=2&limit=10");
    });
  });
});
