// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("@/services/shared/authorization.service", () => ({
  isStaffScopeRestricted: vi.fn().mockReturnValue(false),
  getScopedHostelIds: vi.fn().mockReturnValue([]),
}));

const mockCountByEventType = vi.fn();
const mockCountByMovementMethod = vi.fn();
const mockCountAll = vi.fn();
const mockCountActive = vi.fn();
const mockQrByStatus = vi.fn();
const mockQrScanByResult = vi.fn();
const mockQrScanTrend = vi.fn();
const mockTopScanFailureReasons = vi.fn();
const mockCountOverdueReturns = vi.fn();
const mockTrendByDateRange = vi.fn();
const mockQrTrend = vi.fn();

vi.mock("@/db/repositories/movement/movement-analytics.repository", () => ({
  movementAnalyticsRepository: {
    countByEventType: (...args: any[]) => mockCountByEventType(...args),
    countByMovementMethod: (...args: any[]) => mockCountByMovementMethod(...args),
    qrByStatus: (...args: any[]) => mockQrByStatus(...args),
    qrScanByResult: (...args: any[]) => mockQrScanByResult(...args),
    qrScanTrend: (...args: any[]) => mockQrScanTrend(...args),
    topScanFailureReasons: (...args: any[]) => mockTopScanFailureReasons(...args),
    countOverdueReturns: (...args: any[]) => mockCountOverdueReturns(...args),
    trendByDateRange: (...args: any[]) => mockTrendByDateRange(...args),
    qrTrend: (...args: any[]) => mockQrTrend(...args),
  },
}));

vi.mock("@/db/repositories/movement/qr-pass.repository", () => ({
  qrPassRepository: {
    countAll: (...args: any[]) => mockCountAll(...args),
    countActive: (...args: any[]) => mockCountActive(...args),
  },
}));

import { getMovementAnalytics } from "@/services/analytics/get-movement-analytics.service";

beforeEach(() => {
  vi.resetAllMocks();
  mockCountByEventType.mockResolvedValue([
    { eventType: "EXIT_HOSTEL", count: 8 },
    { eventType: "ENTER_HOSTEL", count: 6 },
  ]);
  mockCountByMovementMethod.mockResolvedValue([{ movementMethod: "QR", count: 10 }]);
  mockCountAll.mockResolvedValue(20);
  mockCountActive.mockResolvedValue(5);
  mockQrByStatus.mockResolvedValue([{ status: "ACTIVE", count: 5 }]);
  mockQrScanByResult.mockResolvedValue({ success: 12, failed: 2 });
  mockQrScanTrend.mockResolvedValue([]);
  mockTopScanFailureReasons.mockResolvedValue([{ reason: "QR_EXPIRED", count: 1 }]);
  mockCountOverdueReturns.mockResolvedValue(3);
  mockTrendByDateRange.mockResolvedValue([]);
  mockQrTrend.mockResolvedValue([]);
});

describe("getMovementAnalytics", () => {
  it("computes total movement events and scan results", async () => {
    const result = await getMovementAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] });

    expect(result.totalMovementEvents).toBe(14);
    expect(result.scanSuccess).toBe(12);
    expect(result.scanFailed).toBe(2);
    expect(result.activeQrPasses).toBe(5);
    expect(result.overdueReturns).toBe(3);
  });

  it("returns the requested period", async () => {
    const result = await getMovementAnalytics({ id: "U1", roles: ["SUPER_ADMIN"] }, "7d");

    expect(result.period).toBe("7d");
    expect(result.movementTrend.length).toBeGreaterThan(0);
  });
});
