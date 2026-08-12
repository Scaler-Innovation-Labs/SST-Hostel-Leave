import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

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
 * Parent-approve token routes — accessed via SMS/email links with embedded tokens.
 * These use per-request tokens, not session-based auth.
 */
const isParentApproveRoute = createRouteMatcher([
  "/api/parent-approve(.*)",
]);

/**
 * Webhook routes — accessed by external services (httpSMS, etc.).
 * Authenticated via JWT/webhook signing keys, not Clerk sessions.
 */
const isWebhookRoute = createRouteMatcher([
  "/api/v1/webhooks(.*)",
]);

export default clerkMiddleware(
  async (auth, request: NextRequest) => {
    const pathname = request.nextUrl.pathname;

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

    // ── Webhook routes ──────────────────────────────────────────────
    // Accessed by external services (httpSMS, etc.) with their own auth.
    if (isWebhookRoute(request)) {
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

export const config = {
  matcher: [
    // Skip Next.js internals, static files, and image optimizations
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
