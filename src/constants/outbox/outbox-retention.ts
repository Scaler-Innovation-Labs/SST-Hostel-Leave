// =====================================================
// OUTBOX RETENTION POLICY
// src/constants/outbox/outbox-retention.ts
// =====================================================

/**
 * Credential-lifetime bound for the outbox.
 *
 * Principle: store the least sensitive representation for the shortest
 * necessary lifetime. Parent approval links are bearer credentials that
 * must exist in the outbox payload for delivery — but once an event is
 * PROCESSED, the payload (including `approvalLink`) has no delivery
 * purpose left. Audit history lives in the audit system, not in retained
 * outbox rows, so processed events are purged after this window.
 *
 * PENDING / PROCESSING / FAILED rows are NEVER purged by this policy:
 * they may still be needed for delivery or retry.
 */
export const OUTBOX_PROCESSED_RETENTION_HOURS = 48;

/**
 * Rows purged per batch. Bounded batches keep a large first-run backlog
 * from starving the cron worker or holding long transactions.
 */
export const OUTBOX_PURGE_BATCH_SIZE = 500;
