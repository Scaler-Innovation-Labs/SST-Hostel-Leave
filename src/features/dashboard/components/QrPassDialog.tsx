"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { QrCodeDisplay } from "@/components/qr/QrCodeDisplay";
import { cn } from "@/lib/utils";

type QrPassDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  token: string;
  /** Shown under the code so the holder knows how long it is good for. */
  validFor?: string;
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
  token,
  validFor,
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

          <div className="rounded-2xl bg-white p-8">
            <QrCodeDisplay token={token} size={320} />
          </div>

          <DialogPrimitive.Description className="text-body text-white/70">
            {validFor ?? "Show this to the guard at the gate."}
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
