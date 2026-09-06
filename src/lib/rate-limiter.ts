import { rateLimitRepository } from "@/db/repositories/rate-limit/rate-limit.repository";
import { TooManyRequestsError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Fixed-window rate limiter backed by PostgreSQL.
 *
 * The previous implementation kept counters in an in-memory Map — on
 * serverless (Vercel) each invocation runs in a fresh or recycled instance,
 * so the limits never held across requests. Counters now live in
 * `rate_limit_entries` and hold globally.
 *
 * Throws a ValidationError ("Too many attempts...") once the window is
 * exhausted so the caller can surface a friendly retry message.
 */
export async function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): Promise<void> {
  const entry = await rateLimitRepository.increment(key, windowMs);

  if (entry.count > maxAttempts) {
    const retryAfter = Math.max(
      1,
      Math.ceil((entry.resetAt.getTime() - Date.now()) / 1000)
    );
    // Security signal: rate-limit hits on token-gated endpoints indicate
    // probing. Log the key PREFIX only — keys embed token hashes which
    // must not enter logs even though they are one-way.
    logger.warn("Rate limit exceeded", {
      scope: key.split(":")[0] ?? "unknown",
      retryAfterSeconds: retryAfter,
    });
    throw new TooManyRequestsError(
      `Too many attempts. Please try again in ${retryAfter} seconds.`,
      retryAfter
    );
  }
}
