import { describe, expect, it } from "vitest";

import { getUserUrl, getUsersUrl } from "@/lib/api/user-api";

describe("user-api", () => {
  describe("getUsersUrl", () => {
    it("returns base URL when no query", () => {
      expect(getUsersUrl()).toBe("/api/v1/users");
    });

    it("includes optional query params", () => {
      const url = getUsersUrl({ role: "STUDENT", page: 2, limit: 10 });
      expect(url).toBe("/api/v1/users?role=STUDENT&page=2&limit=10");
    });

    it("omits undefined params", () => {
      const url = getUsersUrl({ search: "test", role: undefined });
      expect(url).toBe("/api/v1/users?search=test");
    });

    it("includes isActive when true", () => {
      const url = getUsersUrl({ isActive: true });
      expect(url).toBe("/api/v1/users?isActive=true");
    });
  });

  describe("getUserUrl", () => {
    it("returns URL with id", () => {
      expect(getUserUrl("abc-123")).toBe("/api/v1/users/abc-123");
    });
  });
});
