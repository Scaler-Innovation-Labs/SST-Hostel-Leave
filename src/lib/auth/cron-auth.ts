import { ApiResponse } from "@/lib/api/response";

/**
 * Shared cron gate for /api/cron/* routes.
 *
 * Invariant: a missing OR weak CRON_SECRET fails closed with an identical
 * 401 — never distinguishable, never bypassed. Minimum 32 chars (generate
 * with: openssl rand -base64 32). Rotation is an atomic cutover: set the
 * new value in the Vercel project env and redeploy.
 */
const MIN_CRON_SECRET_LENGTH = 32;

export function checkCronAuth(request: Request): Response | null {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (
    !cronSecret ||
    cronSecret.length < MIN_CRON_SECRET_LENGTH ||
    authHeader !== `Bearer ${cronSecret}`
  ) {
    return ApiResponse.error("UNAUTHORIZED", "Unauthorized", 401);
  }

  return null;
}
