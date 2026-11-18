import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/**
 * Public routes that do not require Clerk session authentication.
 *
 * All other routes are protected by default (fail-closed / default-deny):
 * - Dashboard consoles (/student, /admin, /poc, /guard, /super-admin)
 * - User profile (/profile)
 * - Console redirector (/redirect)
 * - API routes (/api/v1/*, /api/docs)
 */
export const isPublicRoute = createRouteMatcher([
  "/login(.*)",
  "/sso-callback(.*)",
  "/unauthorized",
  "/parent-approve(.*)",
  "/api/parent-approve(.*)",
  "/api/health",
  "/api/cron(.*)",
]);

export default clerkMiddleware(
  async (auth, request: NextRequest) => {
    // ── Root path — landing/marketing page or dashboard redirect ───────
    if (request.nextUrl.pathname === "/") {
      const authObj = await auth();
      if (authObj.userId) {
        return NextResponse.redirect(new URL("/redirect", request.url));
      }
      return NextResponse.next();
    }

    // ── Public routes bypass Clerk session enforcement ─────────────────
    if (isPublicRoute(request)) {
      return NextResponse.next();
    }

    // ── Default-deny: all other routes require a valid Clerk session ───
    await auth.protect();

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
