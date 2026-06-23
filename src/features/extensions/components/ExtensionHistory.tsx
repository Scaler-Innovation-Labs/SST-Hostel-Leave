"use client";

import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";

import { ExtensionTimeline } from "./ExtensionTimeline";

type ExtensionHistoryProps = {
  leaveId: string;
}

export function ExtensionHistory({ leaveId }: ExtensionHistoryProps) {
  const { data, isLoading, isError } = useLeaveExtensions(leaveId);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading extensions...</p>;
  if (isError) return <p className="text-sm text-destructive">Failed to load extension history</p>;
  if (!data?.items || data.items.length === 0) return null;

  return (
    <div className="mt-6 space-y-3">
      <h3 className="text-sm font-semibold">Extension History</h3>
      <ExtensionTimeline extensions={data.items} />
    </div>
  );
}
