import { describe, expect, it } from "vitest";

import {
  getLeaveAnalyticsUrl,
  getMovementAnalyticsUrl,
  getRejectionAnalyticsUrl,
  getStudentAnalyticsUrl,
} from "@/lib/api/analytics-api";

describe("analytics-api", () => {
  it("builds student analytics URL", () => {
    expect(getStudentAnalyticsUrl("7d")).toBe("/api/v1/analytics/students?period=7d");
  });

  it("builds leave analytics URL", () => {
    expect(getLeaveAnalyticsUrl("30d")).toBe("/api/v1/analytics/leaves?period=30d");
  });

  it("builds movement analytics URL", () => {
    expect(getMovementAnalyticsUrl("90d")).toBe("/api/v1/analytics/movements?period=90d");
  });

  it("builds rejection analytics URL", () => {
    expect(getRejectionAnalyticsUrl("all")).toBe("/api/v1/analytics/rejections?period=all");
  });
});