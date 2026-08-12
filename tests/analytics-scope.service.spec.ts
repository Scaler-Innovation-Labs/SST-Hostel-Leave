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