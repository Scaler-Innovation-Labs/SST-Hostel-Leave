import { ValidationError } from "@/lib/errors";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitEntry>();

const CLEANUP_INTERVAL = 60_000;

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

export function rateLimit(
  key: string,
  maxAttempts: number,
  windowMs: number,
): void {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
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
