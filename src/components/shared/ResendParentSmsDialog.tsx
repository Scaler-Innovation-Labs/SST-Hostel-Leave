"use client";

import { Loader2, Phone, Send } from "lucide-react";
import { useMemo, useState } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/design-system/sst";
import { cn } from "@/lib/utils";

export type ParentSmsOption = {
  id: string;
  name: string;
  relationship?: string | null;
  phone?: string | null;
  isPrimary?: boolean;
};

type ResendParentSmsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parents: ParentSmsOption[];
  defaultParentId?: string | null;
  loading?: boolean;
  onConfirm: (parentId?: string) => Promise<void> | void;
};

function pickInitialParentId(
  parents: ParentSmsOption[],
  defaultParentId?: string | null
): string | undefined {
  const validParents = parents.filter((p) => Boolean(p.phone?.trim()));
  if (validParents.length === 0) return undefined;

  if (defaultParentId) {
    const matched = validParents.find((p) => p.id === defaultParentId);
    if (matched) return matched.id;
  }

  return (validParents.find((p) => p.isPrimary) ?? validParents[0])?.id;
}

export function ResendParentSmsDialog({
  open,
  onOpenChange,
  parents,
  defaultParentId,
  loading = false,
  onConfirm,
}: ResendParentSmsDialogProps) {
  const [manualParentId, setManualParentId] = useState<string | undefined>(undefined);

  const defaultSelectedId = useMemo(
    () => pickInitialParentId(parents, defaultParentId),
    [parents, defaultParentId]
  );

  const selectedParentId = useMemo(() => {
    if (
      manualParentId &&
      parents.some((p) => p.id === manualParentId && Boolean(p.phone?.trim()))
    ) {
      return manualParentId;
    }
    return defaultSelectedId;
  }, [manualParentId, parents, defaultSelectedId]);

  const hasAnyParents = parents.length > 0;
  const hasValidPhone = useMemo(
    () => parents.some((p) => Boolean(p.phone?.trim())),
    [parents]
  );

  const canSend = !loading && (!hasAnyParents || (hasValidPhone && Boolean(selectedParentId)));

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!loading) {
          if (!next) setManualParentId(undefined);
          onOpenChange(next);
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resend Parent Approval SMS</AlertDialogTitle>
          <AlertDialogDescription>
            Select which parent phone number should receive the fresh approval link.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {!hasAnyParents ? (
            <p className="rounded-lg border border-border bg-surface-sunken/50 px-3 py-2.5 text-caption text-muted">
              Parent list unavailable — sending will use the currently assigned parent contact.
            </p>
          ) : (
            parents.map((parent) => {
              const phone = parent.phone?.trim() ?? "";
              const hasPhone = phone.length > 0;
              const isSelected = selectedParentId === parent.id;

              return (
                <button
                  key={parent.id}
                  type="button"
                  disabled={!hasPhone || loading}
                  onClick={() => hasPhone && setManualParentId(parent.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-left transition-colors",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border bg-surface hover:bg-surface-sunken/50",
                    (!hasPhone || loading) && "cursor-not-allowed opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-body font-medium text-ink">
                        {parent.name}
                      </span>
                      {parent.relationship && (
                        <Badge tone="neutral">{parent.relationship}</Badge>
                      )}
                      {parent.isPrimary && (
                        <Badge tone="info">Primary</Badge>
                      )}
                    </div>
                    <p className="mt-1 flex items-center gap-1.5 font-mono text-caption text-muted">
                      <Phone className="h-3 w-3 shrink-0" />
                      {hasPhone ? phone : "No phone number"}
                    </p>
                  </div>
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                      isSelected ? "border-primary" : "border-muted"
                    )}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-primary" />}
                  </span>
                </button>
              );
            })
          )}

          {hasAnyParents && !hasValidPhone && (
            <p className="text-caption text-danger">
              None of the student&apos;s parent contacts have a phone number on file.
            </p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            type="button"
            disabled={!canSend}
            onClick={() => onConfirm(selectedParentId)}
            className="gap-1.5"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send SMS
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default ResendParentSmsDialog;
