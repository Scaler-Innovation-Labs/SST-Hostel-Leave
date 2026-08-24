"use client";

import { CountBadge } from "@/components/shared/CountBadge";
import { useNavBadges } from "@/hooks/use-badges";

/**
 * Live count of pending approvals, shown as a badge on the Approvals
 * nav item. Scoped to the current user's role/hostels by the API.
 *
 * Consumes the aggregated /api/v1/badges endpoint (see useNavBadges) —
 * one request serves all three nav badges.
 */
export function ApprovalCountBadge({ className }: { className?: string }) {
  const { approvalsCount } = useNavBadges();

  return <CountBadge count={approvalsCount} tone="amber" className={className} />;
}
