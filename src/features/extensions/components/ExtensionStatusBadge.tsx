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
  pending: "bg-warning-light text-warning",
  approved: "bg-success-light text-success",
  rejected: "bg-danger-light text-danger",
  cancelled: "bg-surface-sunken text-muted",
};

export function ExtensionStatusBadge({ status }: ExtensionStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm px-3 py-1 text-caption font-medium capitalize",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}
