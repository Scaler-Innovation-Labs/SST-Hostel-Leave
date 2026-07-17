import { ValidationError } from "@/lib/errors";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type FailureEntry = {
  consecutiveFailures: number;
  lockedUntil: number;
};

const rateStore = new Map<string, RateLimitEntry>();
const failureStore = new Map<string, FailureEntry>();

const CLEANUP_INTERVAL = 60_000;

const MAX_CONSECUTIVE_FAILURES = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateStore) {
    if (entry.resetAt <= now) {
      rateStore.delete(key);
    }
  }
  for (const [key, entry] of failureStore) {
    if (entry.lockedUntil <= now) {
      failureStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): void {
  const now = Date.now();
  const entry = rateStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateStore.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }

  if (entry.count >= maxAttempts) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    throw new ValidationError(
      `Too many attempts. Please try again in ${retryAfter} seconds.`,
    );
  }

  entry.count++;
}

export function trackFailure(key: string): void {
  const now = Date.now();
  const entry = failureStore.get(key);

  if (!entry || entry.lockedUntil <= now) {
    failureStore.set(key, {
      consecutiveFailures: 1,
      lockedUntil: now + LOCKOUT_DURATION_MS,
    });
    return;
  }

  entry.consecutiveFailures++;

  if (entry.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_DURATION_MS;
    throw new ValidationError(
      "Too many failed attempts. Your account has been temporarily locked. Please try again after 15 minutes.",
    );
  }
}

export function isLocked(key: string): boolean {
  const now = Date.now();
  const entry = failureStore.get(key);
  if (!entry || entry.lockedUntil <= now) return false;
  return entry.consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
}

export function resetFailures(key: string): void {
  failureStore.delete(key);
}
