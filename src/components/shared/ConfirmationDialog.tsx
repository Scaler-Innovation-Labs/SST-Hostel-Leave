"use client";

import { ConfirmDialog } from "@/design-system/sst";

type ConfirmationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The question, naming the action: "Cancel this leave request?" */
  title: string;
  /** What happens if they go ahead, including anything irreversible. */
  consequence: string;
  /** The action, as a verb. Never "OK", "Yes" or "Confirm". */
  confirmLabel: string;
  /** What dismissing preserves: "Keep it". Never "Cancel". */
  dismissLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  loading?: boolean;
};

/**
 * Kept as the shared entry point for existing call sites; the implementation
 * is the design system's. `consequence` and `confirmLabel` are required with
 * no defaults, so a caller cannot fall back to "Are you sure? / OK / Cancel".
 */
export function ConfirmationDialog({
  dismissLabel = "Keep it",
  ...props
}: ConfirmationDialogProps) {
  return <ConfirmDialog dismissLabel={dismissLabel} {...props} />;
}
