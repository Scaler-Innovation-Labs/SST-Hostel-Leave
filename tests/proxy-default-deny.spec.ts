import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { isPublicRoute } from "@/proxy";

describe("Proxy default-deny route protection", () => {
  function makeReq(pathname: string): NextRequest {
    return new NextRequest(new URL(pathname, "http://localhost:3000"));
  }

  describe("Public routes (bypass Clerk authentication)", () => {
    const publicPaths = [
      "/login",
      "/login/sso",
      "/sso-callback",
      "/sso-callback/oauth",
      "/unauthorized",
      "/parent-approve/sample-token-123",
      "/api/parent-approve/sample-token-123/decision",
      "/api/health",
      "/api/cron/cleanup",
      "/api/cron/maintenance",
    ];

    it.each(publicPaths)("allows public access to %s", (path) => {
      expect(isPublicRoute(makeReq(path))).toBe(true);
    });
  });

  describe("Protected routes (must be caught by default-deny auth.protect())", () => {
    const protectedPaths = [
      "/profile",
      "/redirect",
      "/student/dashboard",
      "/student/leaves",
      "/student/leaves/new",
      "/admin/dashboard",
      "/admin/approvals",
      "/poc/dashboard",
      "/poc/approvals/abc",
      "/guard/scanner",
      "/guard/manual-movement",
      "/super-admin/dashboard",
      "/super-admin/users",
      "/super-admin/workflows",
      "/api/docs",
      "/api/v1/leaves",
      "/api/v1/hostels",
      "/api/v1/dashboard/stats",
      "/api/v1/openapi.json",
      "/some-unexpected-new-page",
      "/api/v2/new-endpoint",
    ];

    it.each(protectedPaths)("denies unauthenticated access to %s (requires auth.protect())", (path) => {
      expect(isPublicRoute(makeReq(path))).toBe(false);
    });
  });
});
