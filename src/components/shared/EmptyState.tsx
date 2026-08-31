import { Inbox } from "lucide-react";
import type React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** An icon in a tinted tile. Never an illustration or stock art. */
  icon?: React.ReactNode;
  /** Why it is empty, in the reader's terms: "No leave requests yet". */
  title: string;
  /** What fills it. */
  description?: string;
  /** The control that fills it. */
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface-sunken px-6 py-12 text-center",
        className
      )}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-light text-accent ring-1 ring-inset ring-accent/10 [&_svg]:h-5 [&_svg]:w-5">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden />}
      </span>
      <h3 className="mt-4 text-small font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-caption text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
