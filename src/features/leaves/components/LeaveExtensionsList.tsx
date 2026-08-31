"use client";

import { Check, Clock, Repeat, X } from "lucide-react";
import { useState } from "react";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { Badge, Button, ErrorState, RowSkeleton } from "@/design-system/sst";
import { useLeaveExtensions } from "@/features/extensions/hooks/use-leave-extensions";
import { formatRelative } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

const VISIBLE_BY_DEFAULT = 3;

const DECISION = {
  approved: { tone: "success", label: "Approved", Icon: Check },
  rejected: { tone: "danger", label: "Rejected", Icon: X },
  pending: { tone: "warning", label: "Awaiting decision", Icon: Clock },
} as const;

function decisionFor(status: string | null | undefined) {
  const key = (status ?? "").toLowerCase();
  return DECISION[key as keyof typeof DECISION] ?? DECISION.pending;
}

/**
 * Extensions are amendments to an existing leave, never new leave requests, so
 * they are listed against the leave rather than beside it.
 */
export function LeaveExtensionsList({ leaveId }: { leaveId: string }) {
  const { data, isLoading, isError } = useLeaveExtensions(leaveId);
  const [showAll, setShowAll] = useState(false);

  const items = data?.items ?? [];

  if (isLoading) {
    return (
      <CollapsibleSection title="Extensions" icon={Repeat}>
        <RowSkeleton rows={2} />
      </CollapsibleSection>
    );
  }

  if (isError) {
    return (
      <CollapsibleSection title="Extensions" icon={Repeat}>
        <ErrorState
          title="We couldn't load the extensions"
          description="The rest of this leave is unaffected."
        />
      </CollapsibleSection>
    );
  }

  // A leave with no extensions has nothing to say about them.
  if (items.length === 0) return null;

  const displayed = showAll ? items : items.slice(0, VISIBLE_BY_DEFAULT);

  return (
    <CollapsibleSection
      title="Extensions"
      icon={Repeat}
      meta={`${items.length} requested`}
    >
      <div className="space-y-3">
        {displayed.map((extension) => {
          const { tone, label, Icon } = decisionFor(extension.status);

          return (
            <div
              key={extension.id}
              className="flex gap-3 rounded-xl border border-border bg-surface-sunken p-4"
            >
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset",
                  {
                    success: "bg-success-light text-success ring-success/10",
                    danger: "bg-danger-light text-danger ring-danger/10",
                    warning: "bg-warning-light text-warning ring-warning/10",
                  }[tone]
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-small font-semibold text-ink">
                    Extension {extension.extensionNumber}
                  </span>
                  <Badge tone={tone}>{label}</Badge>
                </div>
                {extension.createdAt && (
                  <p className="mt-0.5 text-caption text-muted">
                    Requested {formatRelative(extension.createdAt)}
                  </p>
                )}
                {extension.reason && (
                  <p className="mt-1 text-caption text-muted">
                    {extension.reason}
                  </p>
                )}
              </div>
            </div>
          );
        })}

        {items.length > VISIBLE_BY_DEFAULT && (
          <Button
            variant="ghost"
            size="sm"
            block
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Show fewer"
              : `Show all ${items.length} extensions`}
          </Button>
        )}
      </div>
    </CollapsibleSection>
  );
}
