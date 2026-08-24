import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import type { CurrentUser } from "@/lib/auth/types";
import { listApprovals } from "@/services/leave/list-approvals.service";
import { listExtensionApprovals } from "@/services/leave/list-extension-approvals.service";
import { countOverdueReturns } from "@/services/movement/count-overdue-returns.service";

export type NavBadges = {
  approvals: number;
  extensionApprovals: number;
  overdue: number;
};

/**
 * Nav badge counts for staff dashboards, in one round trip.
 *
 * The three sources are independent — resolved in parallel so the HTTP
 * aggregation never turns into sequential database latency. Each count
 * reuses its domain's existing scoped list service (limit 1) so role and
 * hostel scoping stay identical to the pages they link to.
 */
export async function getNavBadges(
  currentUser: CurrentUser
): Promise<NavBadges> {
  const [approvals, extensionApprovals, overdue] = await Promise.all([
    listApprovals(
      {
        status: LEAVE_APPROVAL_DECISION.PENDING,
        page: 1,
        limit: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      currentUser
    ).then((r) => r.total),

    listExtensionApprovals(
      {
        page: 1,
        limit: 1,
        sortBy: "createdAt",
        sortOrder: "desc",
      },
      currentUser
    ).then((r) => r.stats?.pending ?? 0),

    countOverdueReturns(currentUser),
  ]);

  return { approvals, extensionApprovals, overdue };
}
