import { rateLimitRepository } from "@/db/repositories/rate-limit/rate-limit.repository";
import { logger } from "@/lib/logger";

/**
 * Rate limit cleanup job: deletes expired rate_limit_entries older than the retention window.
 * Default retention is 24 hours.
 */
export async function runCleanupRateLimitJob(
  retentionMs = 86_400_000
): Promise<{ job: string; deleted: number }> {
  const deleted = await rateLimitRepository.deleteExpired(retentionMs);

  logger.info("Rate limit retention cleanup completed", {
    job: "cleanup-rate-limit",
    deleted,
  });

  return {
    job: "cleanup-rate-limit",
    deleted,
  };
}
