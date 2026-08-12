import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getScopedHostelIds,
  isStaffScopeRestricted,
} from "@/services/shared/authorization.service";

/**
 * Overdue returns: leaves where the student checked out (QR pass scanned at
 * exit) but has not checked back in (pass not closed) and the leave duration
 * has ended. HOSTEL-scoped staff see only their own hostels' students.
 */
export async function listOverdueReturns(currentUser: CurrentUser) {
  const hostelIds = isStaffScopeRestricted(currentUser)
    ? getScopedHostelIds(currentUser)
    : undefined;

  return qrPassRepository.findOverdueReturns({ hostelIds, limit: 200 });
}
