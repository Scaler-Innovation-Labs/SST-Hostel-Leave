"use client";

import useSWR from "swr";

import { LEAVE_APPROVAL_DECISION } from "@/constants/leave/leave-approval-decision";
import { getApprovalsUrl } from "@/lib/api/approval-api";
import { cn } from "@/lib/utils";

/**
 * Live count of pending approvals, shown as a badge on the Approvals
 * nav item. Scoped to the current user's role by the API.
 */
export function ApprovalCountBadge({ className }: { className?: string }) {
  const { data } = useSWR(
    getApprovalsUrl({ status: LEAVE_APPROVAL_DECISION.PENDING, page: 1, limit: 1 }),
    { refreshInterval: 15_000 },
  );

  const count = (data?.data?.total as number | undefined) ?? 0;

  if (count === 0) return null;

  return (
    <span
      className={cn(
        "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-amber-500/15 px-1.5 text-[11px] font-semibold leading-none text-amber-600 tabular-nums dark:bg-amber-500/20 dark:text-amber-400",
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
