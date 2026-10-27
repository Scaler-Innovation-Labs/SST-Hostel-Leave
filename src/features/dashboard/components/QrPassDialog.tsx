"use client";

import { Clock, RefreshCw, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { Button } from "@/design-system/sst";
import { cn } from "@/lib/utils";

type QrPassDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Hosted PNG URL (same bytes as the approval email): /api/v1/qr/{passId}/image */
  imageUrl: string;
  /** Shown under the code so the holder knows how long it is good for. */
  validFor?: string;
  /** Seconds remaining in the 20-second display window. */
  timeLeft?: number;
  /** Whether the 20-second active display window has elapsed. */
  isExpired?: boolean;
  /** Callback to rotate and mint a fresh pass token. */
  onRegenerate?: () => void | Promise<void>;
  /** Indicates regeneration is in progress. */
  regenerating?: boolean;
};

/**
 * The pass at arm's length, for showing to a guard.
 *
 * A real dialog rather than a bare overlay: focus is trapped, Escape closes
 * it, and focus returns to the control that opened it. The code sits on white
 * in both themes — a scanner needs the contrast, not the palette.
 */
export function QrPassDialog({
  open,
  onOpenChange,
  imageUrl,
  validFor,
  timeLeft,
  isExpired = false,
  onRegenerate,
  regenerating = false,
}: QrPassDialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-scaler-ink/90",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-base",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-fast"
          )}
        >
          <DialogPrimitive.Title className="font-mono text-micro uppercase tracking-wider text-white/70">
            Gate pass
          </DialogPrimitive.Title>

          {isExpired ? (
            <div className="flex h-[380px] w-[340px] flex-col items-center justify-center gap-3 rounded-2xl bg-white p-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-sunken text-ink">
                <RefreshCw className="h-6 w-6 text-accent" aria-hidden />
              </div>
              <p className="text-small font-semibold text-ink">
                Pass hidden for security
              </p>
              <p className="text-caption text-muted">
                QR passes expire after 20 seconds. Prior screenshots cannot be scanned.
              </p>
              {onRegenerate ? (
                <Button
                  size="sm"
                  onClick={onRegenerate}
                  loading={regenerating}
                  loadingText="Generating…"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                  Regenerate pass
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-8">
              <QrCodeDisplay imageUrl={imageUrl} size={320} />
              {typeof timeLeft === "number" ? (
                <div className="flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1 text-micro font-medium text-ink">
                  <Clock className="h-3 w-3 text-accent" aria-hidden />
                  <span>Expires in {timeLeft}s</span>
                </div>
              ) : null}
            </div>
          )}

          <DialogPrimitive.Description className="text-body text-white/70">
            {isExpired
              ? "Regenerate the pass before showing to the guard."
              : (validFor ?? "Show this to the guard at the gate.")}
          </DialogPrimitive.Description>

          <DialogPrimitive.Close
            className={cn(
              "absolute right-0 top-0 -translate-y-14 rounded-full bg-white/10 p-2 text-white/70",
              "transition-colors duration-fast ease-standard hover:bg-white/20 hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            )}
            aria-label="Close the pass"
          >
            <X className="h-5 w-5" aria-hidden />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
