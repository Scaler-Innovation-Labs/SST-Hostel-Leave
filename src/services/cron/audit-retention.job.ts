import { auditRepository } from "@/db/repositories/audit/audit.repository";

/**
 * Audit retention cleanup: deletes STATE_TRANSITION and USER_ACTION audit
 * rows past their expiresAt. CONFIG_MUTATION rows (expiresAt NULL) are
 * kept forever — they are the configuration history the system reconstructs
 * past decisions from.
 */
export async function runAuditRetentionJob(): Promise<{
  job: string;
  deleted: number;
}> {
  const deleted = await auditRepository.deleteExpired(new Date());

  return {
    job: "audit-retention",
    deleted,
  };
}
