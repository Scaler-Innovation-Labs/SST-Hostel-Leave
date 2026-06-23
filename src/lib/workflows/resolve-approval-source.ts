import type { LeaveApprovalSource } from "@/constants/leave/approval-source";

/**
 * Resolves the approval source based on the step's approval method
 * and whether the step is a parent approval step.
 */
export function resolveApprovalSource(
  method: string | null,
  isParent: boolean
): LeaveApprovalSource {
  if (isParent && !method) return "SMS";
  if (isParent && method === "PORTAL") return "PORTAL";
  if (method === "PORTAL" || !method) return "PORTAL";
  if (method === "SMS_REPLY") return "SMS_REPLY";
  if (method === "SMS_LINK" || method === "SMS_AND_LINK") return "EMAIL_LINK";
  if (method === "AUTO") return "SYSTEM";
  return "WEB";
}
