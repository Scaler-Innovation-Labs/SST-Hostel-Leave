"use client";

import { CountBadge } from "@/components/shared/CountBadge";
import { useExtensionApprovals } from "@/features/extensions/hooks/use-approve-extension";

/**
 * Live count of pending extension approvals, shown on the Extension
 * Approvals nav item. Scoped to the current user's role/hostels by the API.
 */
export function ExtensionApprovalCountBadge({ className }: { className?: string }) {
  const { data } = useExtensionApprovals({ page: 1, limit: 1 });

  const count = data?.stats?.pending ?? 0;

  return <CountBadge count={count} tone="blue" className={className} />;
}
