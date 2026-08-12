// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockGetStudentAnalytics = vi.fn();
const mockGetLeaveAnalytics = vi.fn();
const mockGetMovementAnalytics = vi.fn();
const mockGetRejectionAnalytics = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ id: "U1", roles: ["ADMIN"] }),
}));

vi.mock("@/services/analytics/get-student-analytics.service", () => ({
  getStudentAnalytics: (...args: any[]) => mockGetStudentAnalytics(...args),
}));

vi.mock("@/services/analytics/get-leave-analytics.service", () => ({
  getLeaveAnalytics: (...args: any[]) => mockGetLeaveAnalytics(...args),
}));

vi.mock("@/services/analytics/get-movement-analytics.service", () => ({
  getMovementAnalytics: (...args: any[]) => mockGetMovementAnalytics(...args),
}));

vi.mock("@/services/analytics/get-rejection-analytics.service", () => ({
  getRejectionAnalytics: (...args: any[]) => mockGetRejectionAnalytics(...args),
}));

import { GET as GET_STUDENTS } from "@/app/api/v1/analytics/students/route";
import { GET as GET_LEAVES } from "@/app/api/v1/analytics/leaves/route";
import { GET as GET_MOVEMENTS } from "@/app/api/v1/analytics/movements/route";
import { GET as GET_REJECTIONS } from "@/app/api/v1/analytics/rejections/route";

describe("GET /api/v1/analytics/*", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetStudentAnalytics.mockResolvedValue({ period: "30d", totalStudents: 10 });
    mockGetLeaveAnalytics.mockResolvedValue({ period: "30d", totalLeaves: 5 });
    mockGetMovementAnalytics.mockResolvedValue({ period: "30d", totalMovementEvents: 3 });
    mockGetRejectionAnalytics.mockResolvedValue({ period: "30d", totalRejections: 2 });
  });

  it("students endpoint returns data with default period", async () => {
    const res = await GET_STUDENTS();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.totalStudents).toBe(10);
    expect(mockGetStudentAnalytics).toHaveBeenCalledWith(expect.objectContaining({ id: "U1" }), undefined);
  });

  it("students endpoint forwards the period query param", async () => {
    const req = new Request("http://localhost/api/v1/analytics/students?period=7d");
    const res = await GET_STUDENTS(req);
    expect(res.status).toBe(200);
    expect(mockGetStudentAnalytics).toHaveBeenLastCalledWith(expect.objectContaining({ id: "U1" }), "7d");
  });

  it("students endpoint rejects invalid period", async () => {
    const req = new Request("http://localhost/api/v1/analytics/students?period=invalid");
    const res = await GET_STUDENTS(req);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it("leaves endpoint returns data", async () => {
    const res = await GET_LEAVES();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.totalLeaves).toBe(5);
  });

  it("movements endpoint returns data", async () => {
    const res = await GET_MOVEMENTS();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.totalMovementEvents).toBe(3);
  });

  it("rejections endpoint returns data", async () => {
    const res = await GET_REJECTIONS();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.totalRejections).toBe(2);
  });

  it("returns 401 when not authenticated", async () => {
    const { requireAuth } = await import("@/lib/auth/require-auth");
    requireAuth.mockRejectedValue(new (await import("@/lib/errors")).AuthenticationError());

    const res = await GET_STUDENTS();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });
});