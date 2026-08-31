"use client";

import { CountBadge } from "@/components/shared/CountBadge";
import { useNavBadges } from "@/hooks/use-badges";

/**
 * Live count of pending extension approvals, shown on the Extension
 * Approvals nav item. Scoped to the current user's role/hostels by the API.
 *
 * Consumes the aggregated /api/v1/badges endpoint (see useNavBadges) —
 * one request serves all three nav badges.
 */
export function ExtensionApprovalCountBadge({ className }: { className?: string }) {
  const { extensionApprovalsCount } = useNavBadges();

  return (
    <CountBadge
      count={extensionApprovalsCount}
      tone="accent"
      className={className}
    />
  );
}
