"use client";

import useSWR from "swr";

import { CountBadge } from "@/components/shared/CountBadge";
import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { getApprovalsUrl } from "@/lib/api/approval-api";

/**
 * Live count of pending approvals, shown as a badge on the Approvals
 * nav item. Scoped to the current user's role/hostels by the API.
 */
export function ApprovalCountBadge({ className }: { className?: string }) {
  const { data } = useSWR(
    getApprovalsUrl({ status: LEAVE_APPROVAL_DECISION.PENDING, page: 1, limit: 1 }),
    { refreshInterval: 15_000 },
  );

  const count = (data?.data?.total as number | undefined) ?? 0;

  return <CountBadge count={count} tone="amber" className={className} />;
}
