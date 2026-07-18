import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { PARENT_JWT_COOKIE, verifyParentJwt } from "@/lib/jwt";

/**
 * Routes that require Clerk authentication (student, admin, POC, super-admin).
 */
const isAuthenticatedRoute = createRouteMatcher([
  "/student(.*)",
  "/admin(.*)",
  "/poc(.*)",
  "/super-admin(.*)",
  "/api/v1(.*)",
]);

/**
 * Routes that use parent OTP/JWT auth (not Clerk).
 * These include parent pages AND parent API routes.
 */
const isParentRoute = createRouteMatcher([
  "/parent(.*)",
  "/api/v1/auth/parent(.*)",
  "/api/v1/parent/(.*)",
]);

/**
 * Parent routes that require NO auth at the proxy level.
 * These handle their own auth (OTP validation, rate limiting, etc.).
 */
const isParentUnprotectedRoute = createRouteMatcher([
  "/parent/login(.*)",
  "/api/v1/auth/parent/send-otp(.*)",
  "/api/v1/auth/parent/verify(.*)",
]);

/**
 * Parent-approve token routes — accessed via SMS/email links with embedded tokens.
 * These use per-request tokens, not session-based auth.
 */
const isParentApproveRoute = createRouteMatcher([
  "/api/parent-approve(.*)",
]);

export default clerkMiddleware(
  async (auth, request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

    // ── Unauthenticated parent routes ───────────────────────────────
    // Parent login pages and OTP verification endpoints handle their
    // own auth internally. No proxy-level checks needed.
    if (isParentUnprotectedRoute(request)) {
      return NextResponse.next();
    }

    // ── Parent-authenticated routes ─────────────────────────────────
    // Parent dashboard pages and parent API routes require a valid
    // parent JWT session cookie. Parents are NOT Clerk users.
    if (isParentRoute(request)) {
      const token = getCookie(request, PARENT_JWT_COOKIE);

      if (!token) {
        return redirectToLogin("/parent/login", request);
      }

      try {
        await verifyParentJwt(token);
      } catch {
        return redirectToLogin("/parent/login", request);
      }

      return NextResponse.next();
    }

    // ── Parent-approve token routes ─────────────────────────────────
    // These use per-request tokens from SMS/email links.
    // Validation happens in the route handlers themselves.
    if (isParentApproveRoute(request)) {
      return NextResponse.next();
    }

    // ── Root path — redirect authenticated users to their dashboard ─
    if (pathname === "/") {
      const authObj = await auth();
      if (authObj.userId) {
        return NextResponse.redirect(new URL("/redirect", request.url));
      }
      return NextResponse.next();
    }

    // ── Clerk-authenticated routes ──────────────────────────────────
    // Protect student, admin, POC, super-admin dashboards
    if (isAuthenticatedRoute(request)) {
      await auth.protect();
    }

    return NextResponse.next();
  },
);

/**
 * Read a cookie from the request.
 */
function getCookie(request: NextRequest, name: string): string | null {
  const cookie = request.cookies.get(name);
  return cookie?.value ?? null;
}

/**
 * Redirect to a login page preserving the original destination.
 */
function redirectToLogin(loginPath: string, request: NextRequest): NextResponse {
  const loginUrl = new URL(loginPath, request.url);
  loginUrl.searchParams.set("redirect_url", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and image optimizations
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
