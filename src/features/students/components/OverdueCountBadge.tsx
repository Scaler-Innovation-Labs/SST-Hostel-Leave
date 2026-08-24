"use client";

import { CountBadge } from "@/components/shared/CountBadge";
import { useNavBadges } from "@/hooks/use-badges";

/**
 * Live count of overdue returns (students checked out past their leave end
 * date), shown on the Overdue nav item. Scoped to the current user's hostels
 * by the API.
 *
 * Consumes the aggregated /api/v1/badges endpoint (see useNavBadges) —
 * one request serves all three nav badges.
 */
export function OverdueCountBadge({ className }: { className?: string }) {
  const { overdueCount } = useNavBadges();

  return <CountBadge count={overdueCount} tone="red" className={className} />;
}
