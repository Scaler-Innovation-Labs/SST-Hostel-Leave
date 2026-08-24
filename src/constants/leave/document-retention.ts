// =====================================================
// DOCUMENT RETENTION POLICY
// src/constants/leave/document-retention.ts
// =====================================================

/**
 * How long documents are kept after their leave reaches a terminal state
 * (COMPLETED, REJECTED, CANCELLED, EXPIRED). After this period the file is
 * deleted from Cloudinary and the DB row is soft-deleted (DELETED) so the
 * audit trail survives while storage cost stops growing.
 *
 * Active leaves (PENDING/APPROVED/OVERDUE) always retain documents.
 */
export const DOCUMENT_RETENTION_YEARS = 3;

/**
 * Documents removed per job run. Bounded batches keep a large backlog from
 * starving the cron worker or hammering Cloudinary rate limits.
 */
export const DOCUMENT_RETENTION_BATCH_SIZE = 100;
