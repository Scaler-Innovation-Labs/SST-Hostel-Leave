"use client";

import { cn } from "@/lib/utils";

type ExtensionStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled";

type ExtensionStatusBadgeProps = {
  status: ExtensionStatus;
}

const styles: Record<ExtensionStatus, string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

export function ExtensionStatusBadge({ status }: ExtensionStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium capitalize",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
