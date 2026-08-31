"use client";

import { AlertDialog as AlertDialogPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

import { Button } from "./Button";

type ConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, naming the action: "Cancel this leave request?" */
  title: string;
  /**
   * What happens if they go ahead — including anything irreversible and any
   * penalty incurred. Required: there is no safe default for a consequence.
   */
  consequence: string;
  /**
   * The action, as a verb: "Cancel leave request", "Reject extension". Never
   * "OK", "Yes" or "Confirm". Required for the same reason.
   */
  confirmLabel: string;
  /**
   * What dismissing preserves: "Keep it". Never "Cancel", which is ambiguous
   * when the action itself is called cancel.
   */
  dismissLabel: string;
  /** Bulk operations state the count and are transactional. */
  count?: number;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
};

/**
 * Every destructive action goes through this: cancelling, admin override, bulk
 * operations, blocking a user, deleting a resource. Never a bare `confirm()`,
 * never one tap.
 *
 * `consequence`, `confirmLabel` and `dismissLabel` are required props with no
 * defaults, so a caller cannot fall back to "Are you sure? / OK / Cancel".
 */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  consequence,
  confirmLabel,
  dismissLabel,
  count,
  destructive = true,
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-scaler-depth/70 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <AlertDialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4",
            "rounded-2xl border border-border bg-surface p-6 shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-top-1 data-[state=open]:duration-base",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast"
          )}
        >
          <div className="flex flex-col gap-1">
            <AlertDialogPrimitive.Title className="text-h3 text-ink">
              {title}
            </AlertDialogPrimitive.Title>
            <AlertDialogPrimitive.Description className="text-body text-muted">
              {typeof count === "number"
                ? `This affects ${count} ${count === 1 ? "record" : "records"}. ${consequence}`
                : consequence}
            </AlertDialogPrimitive.Description>
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="outline" disabled={loading}>
                {dismissLabel}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <Button
              variant={destructive ? "danger" : "primary"}
              loading={loading}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
