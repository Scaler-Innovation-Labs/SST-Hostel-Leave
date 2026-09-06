/**
 * Outbox → SQS publishing tuning.
 *
 * Delivery state (published to SQS) is tracked independently from
 * processing state (PENDING/PROCESSING/PROCESSED/FAILED) via the
 * `published_at` column: publish retries never consume the handler retry
 * budget, and handler retries never republish.
 */
export const OUTBOX_PUBLISH_BATCH_SIZE = 50;

/** Hold claimed-but-unsent rows out of the next claim for this long. */
export const OUTBOX_PUBLISH_HOLD_MINUTES = 5;

/**
 * A PENDING row stamped `published_at` older than this is assumed lost
 * (SQS accepted but the response was lost, or the message was deleted
 * without processing) and republished. Duplicates are safe: the worker
 * skips PROCESSED rows and claims PENDING rows atomically.
 */
export const OUTBOX_PUBLISH_STALE_MINUTES = 30;

/**
 * Best-effort post-commit SQS attempt waits this long so the business
 * transaction usually commits first. If the row is still invisible the
 * attempt is skipped silently — the recovery publisher owns it.
 */
export const OUTBOX_IMMEDIATE_DELAY_MS = 1_000;

/**
 * A worker that receives a message for a row that does not exist retains
 * (rather than deletes) it while the message is younger than this: the
 * row is probably committed milliseconds after the immediate publish.
 * Older orphans are purged PROCESSED rows (or never-existed) → delete.
 */
export const OUTBOX_PRE_COMMIT_GRACE_MS = 60_000;
