// @ts-nocheck
import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRequireAuth = vi.fn();
const mockResendParentApproval = vi.fn();
const mockListAuditLogs = vi.fn();
const mockGetDashboardStats = vi.fn();
const mockCookieSet = vi.fn();
const mockCookieGet = vi.fn();

vi.mock("@/lib/db", () => ({
  db: { transaction: (cb: any) => cb({}) },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (...args: any[]) => mockCookieGet(...args),
    set: (...args: any[]) => mockCookieSet(...args),
  }),
}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: (...args: any[]) => mockRequireAuth(...args),
}));

vi.mock("@/services/parent/resend-parent-approval.service", () => ({
  resendParentApproval: (...args: any[]) => mockResendParentApproval(...args),
}));

vi.mock("@/services/audit/audit.service", () => ({
  auditService: {
    listAuditLogs: (...args: any[]) => mockListAuditLogs(...args),
  },
}));

vi.mock("@/services/dashboard/get-dashboard-stats.service", () => ({
  getDashboardStats: (...args: any[]) => mockGetDashboardStats(...args),
}));

import { POST as resendParentApprovalRoute } from "@/app/api/v1/leaves/[id]/resend-parent-approval/route";
import { GET as auditRoute } from "@/app/api/v1/audit/route";
import { GET as dashboardStatsRoute } from "@/app/api/v1/dashboard/stats/route";
import { POST as setActiveRoleRoute } from "@/app/api/v1/me/active-role/route";
import { ROLES } from "@/lib/auth/roles";
import { ACTIVE_ROLE_COOKIE } from "@/constants/auth/role-consoles";
import { AuthenticationError, AuthorizationError } from "@/lib/errors";

describe("S7 — Route-Gating and RBAC Audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/v1/leaves/[id]/resend-parent-approval", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockRequireAuth.mockRejectedValue(new AuthenticationError());

      const res = await resendParentApprovalRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "leave-1" }),
      });

      expect(res.status).toBe(401);
      expect(mockResendParentApproval).not.toHaveBeenCalled();
    });

    it("rejects unauthorized roles (e.g. GUARD) with 403", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "guard-1",
        roles: [ROLES.GUARD],
      });

      const res = await resendParentApprovalRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "leave-1" }),
      });

      expect(res.status).toBe(403);
      expect(mockResendParentApproval).not.toHaveBeenCalled();
    });

    it("rejects IDOR / BOLA attempt when student does not own the leave", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "student-1",
        roles: [ROLES.STUDENT],
      });

      mockResendParentApproval.mockRejectedValue(
        new AuthorizationError("You can only access your own student data")
      );

      const res = await resendParentApprovalRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "victim-leave-id" }),
      });

      expect(res.status).toBe(403);
      expect(mockResendParentApproval).toHaveBeenCalledWith(
        "victim-leave-id",
        expect.objectContaining({ id: "student-1", roles: [ROLES.STUDENT] })
      );
    });

    it("allows owner student to resend parent approval", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "student-1",
        roles: [ROLES.STUDENT],
      });

      mockResendParentApproval.mockResolvedValue({
        success: true,
        message: "Parent approval link resent successfully",
      });

      const res = await resendParentApprovalRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "my-leave-id" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockResendParentApproval).toHaveBeenCalledWith(
        "my-leave-id",
        expect.objectContaining({ id: "student-1", roles: [ROLES.STUDENT] })
      );
    });

    it("allows authorized staff (e.g. ADMIN) to resend parent approval", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "admin-1",
        roles: [ROLES.ADMIN],
      });

      mockResendParentApproval.mockResolvedValue({
        success: true,
        message: "Parent approval link resent successfully",
      });

      const res = await resendParentApprovalRoute(new Request("http://localhost"), {
        params: Promise.resolve({ id: "leave-1" }),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
    });
  });

  describe("GET /api/v1/audit", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockRequireAuth.mockRejectedValue(new AuthenticationError());

      const res = await auditRoute(
        new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST&entityId=LR1")
      );

      expect(res.status).toBe(401);
      expect(mockListAuditLogs).not.toHaveBeenCalled();
    });

    it("rejects unauthorized role (e.g. GUARD) with 403", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "guard-1",
        roles: [ROLES.GUARD],
      });

      const res = await auditRoute(
        new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST&entityId=LR1")
      );

      expect(res.status).toBe(403);
      expect(mockListAuditLogs).not.toHaveBeenCalled();
    });

    it("allows authorized roles (e.g. ADMIN) with 200", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "admin-1",
        roles: [ROLES.ADMIN],
      });

      mockListAuditLogs.mockResolvedValue({
        items: [],
        total: 0,
      });

      const res = await auditRoute(
        new Request("http://localhost/api/v1/audit?entityType=LEAVE_REQUEST&entityId=LR1")
      );

      expect(res.status).toBe(200);
      expect(mockListAuditLogs).toHaveBeenCalled();
    });
  });

  describe("GET /api/v1/dashboard/stats", () => {
    it("rejects unauthenticated requests with 401", async () => {
      mockRequireAuth.mockRejectedValue(new AuthenticationError());

      const res = await dashboardStatsRoute();

      expect(res.status).toBe(401);
      expect(mockGetDashboardStats).not.toHaveBeenCalled();
    });

    it("rejects unauthorized role (e.g. GUARD) with 403", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "guard-1",
        roles: [ROLES.GUARD],
      });

      const res = await dashboardStatsRoute();

      expect(res.status).toBe(403);
      expect(mockGetDashboardStats).not.toHaveBeenCalled();
    });

    it("allows student to access their own dashboard stats", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "student-1",
        roles: [ROLES.STUDENT],
      });

      mockGetDashboardStats.mockResolvedValue({ pendingLeaves: 0 });

      const res = await dashboardStatsRoute();

      expect(res.status).toBe(200);
      expect(mockGetDashboardStats).toHaveBeenCalled();
    });
  });

  describe("Active Role privilege escalation prevention", () => {
    it("rejects switching to an unassigned elevated role (e.g. STUDENT trying to become SUPER_ADMIN)", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "student-1",
        roles: [ROLES.STUDENT],
      });

      const req = new Request("http://localhost/api/v1/me/active-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: ROLES.SUPER_ADMIN }),
      });

      const res = await setActiveRoleRoute(req);

      expect(res.status).toBe(403);
    });

    it("allows switching between genuinely assigned roles (e.g. ADMIN and POC)", async () => {
      mockRequireAuth.mockResolvedValue({
        id: "staff-1",
        roles: [ROLES.ADMIN, ROLES.POC],
      });

      const req = new Request("http://localhost/api/v1/me/active-role", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: ROLES.POC }),
      });

      const res = await setActiveRoleRoute(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.activeRole).toBe(ROLES.POC);
      expect(mockCookieSet).toHaveBeenCalledWith(
        ACTIVE_ROLE_COOKIE,
        ROLES.POC,
        expect.any(Object)
      );
    });
  });

  describe("Middleware proxy protection verification", () => {
    it("matches all protected console prefixes including /guard", async () => {
      const proxySource = (await import("fs")).readFileSync("src/proxy.ts", "utf8");

      expect(proxySource).toContain('"/guard(.*)"');
      expect(proxySource).toContain('"/student(.*)"');
      expect(proxySource).toContain('"/admin(.*)"');
      expect(proxySource).toContain('"/poc(.*)"');
      expect(proxySource).toContain('"/super-admin(.*)"');
      expect(proxySource).toContain('"/api/v1(.*)"');
    });

    it("explicitly exempts public parent approval routes", async () => {
      const proxySource = (await import("fs")).readFileSync("src/proxy.ts", "utf8");

      expect(proxySource).toContain('"/parent-approve(.*)"');
      expect(proxySource).toContain('"/api/parent-approve(.*)"');
    });
  });
});
