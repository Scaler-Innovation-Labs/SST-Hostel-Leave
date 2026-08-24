import { qrPassRepository } from "@/db/repositories/movement/qr-pass.repository";
import type { CurrentUser } from "@/lib/auth/types";
import {
  getScopedHostelIds,
  isStaffScopeRestricted,
} from "@/services/shared/authorization.service";

/**
 * Count of overdue returns — same scope rules and predicate as
 * listOverdueReturns, but returns a single number. Powers the sidebar
 * badge, which polls far more often than the list page loads.
 */
export async function countOverdueReturns(currentUser: CurrentUser) {
  const hostelIds = isStaffScopeRestricted(currentUser)
    ? getScopedHostelIds(currentUser)
    : undefined;

  return qrPassRepository.countOverdueReturns({ hostelIds });
}
