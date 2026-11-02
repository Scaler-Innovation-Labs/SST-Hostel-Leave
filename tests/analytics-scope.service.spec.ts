// @ts-nocheck
import { describe, it, expect, vi } from "vitest";

const mockIsStaffScopeRestricted = vi.fn();
const mockGetScopedHostelIds = vi.fn();

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: (...args: any[]) => mockIsStaffScopeRestricted(...args),
  getScopedHostelIds: (...args: any[]) => mockGetScopedHostelIds(...args),
}));

import {
  getAnalyticsHostelScope,
  resolveAnalyticsRange,
} from "@/services/analytics/analytics-scope.service";

describe("resolveAnalyticsRange", () => {
  it("defaults to 30 days", () => {
    const before = new Date();
    const range = resolveAnalyticsRange();
    const after = new Date();
    expect(range.isBounded).toBe(true);
    expect(range.endDate.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(range.endDate.getTime()).toBeLessThanOrEqual(after.getTime());
    const expectedStart = new Date(range.endDate);
    expectedStart.setDate(expectedStart.getDate() - 30);
    expect(Math.abs(range.startDate.getTime() - expectedStart.getTime())).toBeLessThan(1000);
  });

  it("resolves a bounded period", () => {
    const before = new Date();
    const range = resolveAnalyticsRange("7d");
    const after = new Date();
    expect(range.isBounded).toBe(true);
    expect(range.startDate.getTime()).toBeLessThanOrEqual(before.getTime());
    expect(range.startDate.getTime()).toBeGreaterThanOrEqual(new Date(before.getTime() - 8 * 86400000).getTime());
    expect(range.endDate.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("resolves this_month bounded from 1st of month to now", () => {
    const range = resolveAnalyticsRange("this_month");
    const now = new Date();
    expect(range.isBounded).toBe(true);
    expect(range.startDate.getFullYear()).toBe(now.getFullYear());
    expect(range.startDate.getMonth()).toBe(now.getMonth());
    expect(range.startDate.getDate()).toBe(1);
    expect(range.startDate.getHours()).toBe(0);
    expect(range.endDate.getTime()).toBeLessThanOrEqual(now.getTime() + 100);
  });

  it("resolves last_month bounded to full previous month", () => {
    const range = resolveAnalyticsRange("last_month");
    const now = new Date();
    const expectedMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const expectedYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

    expect(range.isBounded).toBe(true);
    expect(range.startDate.getFullYear()).toBe(expectedYear);
    expect(range.startDate.getMonth()).toBe(expectedMonth);
    expect(range.startDate.getDate()).toBe(1);

    expect(range.endDate.getFullYear()).toBe(expectedYear);
    expect(range.endDate.getMonth()).toBe(expectedMonth);
    expect(range.endDate.getHours()).toBe(23);
    expect(range.endDate.getMinutes()).toBe(59);
  });

  it("resolves custom date strings", () => {
    const range = resolveAnalyticsRange("custom", "2026-04-01", "2026-04-15");
    expect(range.isBounded).toBe(true);
    expect(range.startDate.getFullYear()).toBe(2026);
    expect(range.startDate.getMonth()).toBe(3); // 0-indexed April
    expect(range.startDate.getDate()).toBe(1);
    expect(range.startDate.getHours()).toBe(0);

    expect(range.endDate.getFullYear()).toBe(2026);
    expect(range.endDate.getMonth()).toBe(3);
    expect(range.endDate.getDate()).toBe(15);
    expect(range.endDate.getHours()).toBe(23);
  });

  it("swaps custom dates if start > end", () => {
    const range = resolveAnalyticsRange("custom", "2026-05-20", "2026-05-10");
    expect(range.isBounded).toBe(true);
    expect(range.startDate.getDate()).toBe(10);
    expect(range.endDate.getDate()).toBe(20);
  });

  it("resolves all-time as unbounded from the epoch", () => {
    const range = resolveAnalyticsRange("all");
    expect(range.isBounded).toBe(false);
    expect(range.startDate.getTime()).toBe(0);
  });
});

describe("getAnalyticsHostelScope", () => {
  it("returns scoped hostel ids when the user is scope-restricted", () => {
    mockIsStaffScopeRestricted.mockReturnValue(true);
    mockGetScopedHostelIds.mockReturnValue(["H1", "H2"]);
    expect(getAnalyticsHostelScope({ id: "U1", roles: ["ADMIN"] })).toEqual(["H1", "H2"]);
  });

  it("returns undefined (all hostels) for unrestricted users", () => {
    mockIsStaffScopeRestricted.mockReturnValue(false);
    expect(getAnalyticsHostelScope({ id: "U1", roles: ["SUPER_ADMIN"] })).toBeUndefined();
  });
});
